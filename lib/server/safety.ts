/**
 * Trust and safety. Reports → weighted cases → automatic hold → moderator
 * decision → strikes, bans, appeals. Every move is audited.
 *
 * Durable in Postgres. Design rules:
 *   - A report is a signal, never a verdict. Auto-hide is a temporary hold,
 *     always reviewed by a human, always appealable.
 *   - Throwaway accounts cannot take anyone down: reports from new accounts
 *     weigh 0, and reporters must have actually watched.
 *   - Reporters who are repeatedly dismissed lose weight; reporters who are
 *     repeatedly upheld gain it.
 *   - Severe categories (illegal, minor safety) hold on a single valid report
 *     and jump the queue.
 *
 * Ephemeral only: last-message duplicate detection (in-process).
 */
import {
  getRoom,
  setSuspended,
  setFlags,
  roomsOwnedBy,
  isOwnerOrCrew,
} from "./registry";
import { FLAG_LIMIT } from "../access";
import { REASONS, Reason, isReason } from "../reasons";
import { prisma } from "./db";

export { REASONS, isReason };
export type { Reason };

const H = 36e5;
const D = 24 * H;
const cfg = () => ({
  minAge: Number(process.env.SAFETY_MIN_AGE_MS ?? 10 * 60e3),
  dwell: Number(process.env.SAFETY_MIN_DWELL_MS ?? 30e3),
  perHour: 5,
});

export type CaseState =
  | "open"
  | "upheld"
  | "dismissed"
  | "appealed"
  | "reinstated"
  | "expired";

export type Case = {
  id: string;
  kind: "stream" | "user";
  room: string;
  ownerUid: string | null;
  target: string | null;
  reasons: Reason[];
  severe: boolean;
  reporters: Record<string, { weight: number; reason: Reason; at: number }>;
  state: CaseState;
  opened: number;
  held: boolean;
  restoreAt: number | null;
  appeal?: { text: string; at: number };
  decision?: { by: string; at: number; action: string; note: string };
};

export type Res<T = {}> = ({ ok: true } & T) | { ok: false; code: number; error: string };

// Ephemeral: last message per uid (duplicate screen). Not worth a table.
const g = globalThis as any;
const lastMsg: Map<string, { t: string; at: number }> = (g.__guildSafetyLast ??=
  new Map());

function id() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export async function audit(
  by: string,
  action: string,
  detail: object
): Promise<void> {
  try {
    await prisma.safetyAudit.create({
      data: { by, action, detail: detail as any },
    });
  } catch (err) {
    console.error("[safety] audit write failed:", err);
  }
}

export async function auditTail(n = 50) {
  const rows = await prisma.safetyAudit.findMany({
    orderBy: { at: "desc" },
    take: n,
  });
  return rows.map((r) => ({
    at: r.at.getTime(),
    by: r.by,
    action: r.action,
    ...(typeof r.detail === "object" && r.detail ? (r.detail as object) : {}),
  }));
}

// ─── Accounts: seen / dwell / weight ────────────────────────────────────────

export async function touch(uid: string): Promise<void> {
  try {
    await prisma.accountSeen.upsert({
      where: { uid },
      create: { uid },
      update: {},
    });
  } catch {
    /* ignore */
  }
}

/** First moment this account was inside the room (dwell gate for reports). */
export async function enter(room: string, uid: string): Promise<void> {
  try {
    await prisma.roomDwell.upsert({
      where: { roomId_uid: { roomId: room, uid } },
      create: { roomId: room, uid },
      update: {},
    });
  } catch {
    /* ignore */
  }
}

async function weightOf(
  uid: string,
  room: string,
  severe: boolean
): Promise<number> {
  const c = cfg();
  const seen = await prisma.accountSeen.findUnique({ where: { uid } });
  const age = Date.now() - (seen?.firstSeen.getTime() ?? Date.now());
  if (age < c.minAge) return 0;

  if (!severe) {
    const dwell = await prisma.roomDwell.findUnique({
      where: { roomId_uid: { roomId: room, uid } },
    });
    if (Date.now() - (dwell?.enteredAt.getTime() ?? Date.now()) < c.dwell)
      return 0;
  }

  const stats = await prisma.reporterStats.findUnique({ where: { uid } });
  if (stats) {
    const n = stats.upheld + stats.dismissed;
    if (n >= 3) {
      const acc = stats.upheld / n;
      if (acc < 0.3) return 0.25;
      if (acc > 0.7) return 1.5;
    }
  }
  return 1;
}

// ─── Bans / mutes ───────────────────────────────────────────────────────────

export async function isBanned(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const b = await prisma.accountBan.findUnique({ where: { uid } });
  if (!b) return false;
  if (b.until && b.until.getTime() < Date.now()) {
    await prisma.accountBan.delete({ where: { uid } }).catch(() => {});
    return false;
  }
  return true;
}

export async function banInfo(uid: string) {
  const b = await prisma.accountBan.findUnique({ where: { uid } });
  if (!b) return null;
  return {
    until: b.until ? b.until.getTime() : null,
    reason: b.reason,
  };
}

export async function isRoomBanned(
  room: string,
  uid: string | undefined
): Promise<boolean> {
  if (!uid) return false;
  const row = await prisma.roomBan.findUnique({
    where: { roomId_uid: { roomId: room, uid } },
  });
  return !!row;
}

async function ban(
  uid: string,
  until: number | null,
  reason: string,
  by: string
): Promise<void> {
  await prisma.accountBan.upsert({
    where: { uid },
    create: {
      uid,
      until: until ? new Date(until) : null,
      reason,
      by,
    },
    update: {
      until: until ? new Date(until) : null,
      reason,
      by,
    },
  });
  await audit(by, "ban", { uid, until, reason });
}

// ─── Chat screening ─────────────────────────────────────────────────────────

export async function screen(
  room: string,
  uid: string,
  text: string
): Promise<null | "muted" | "banned" | "links" | "duplicate"> {
  if (await isRoomBanned(room, uid)) return "banned";
  const muted = await prisma.roomMute.findUnique({
    where: { roomId_uid: { roomId: room, uid } },
  });
  if (muted) return "muted";
  if ((text.match(/https?:\/\/|www\./gi) ?? []).length > 2) return "links";
  const t = text.trim().toLowerCase();
  const l = lastMsg.get(uid);
  if (l && l.t === t && Date.now() - l.at < 30e3) return "duplicate";
  lastMsg.set(uid, { t, at: Date.now() });
  return null;
}

// ─── Case row ↔ domain Case ─────────────────────────────────────────────────

type CaseRow = Awaited<
  ReturnType<typeof prisma.safetyCase.findFirst>
> & { reporters?: { uid: string; reason: string; weight: number; createdAt: Date }[] };

function toCase(row: NonNullable<CaseRow>): Case {
  const reporters: Case["reporters"] = {};
  for (const r of row.reporters ?? []) {
    reporters[r.uid] = {
      weight: r.weight,
      reason: r.reason as Reason,
      at: r.createdAt.getTime(),
    };
  }
  return {
    id: row.id,
    kind: row.kind as "stream" | "user",
    room: row.roomId,
    ownerUid: row.ownerUid,
    target: row.target,
    reasons: row.reasons as Reason[],
    severe: row.severe,
    reporters,
    state: row.state as CaseState,
    opened: row.openedAt.getTime(),
    held: row.held,
    restoreAt: row.restoreAt ? row.restoreAt.getTime() : null,
    appeal: row.appealText
      ? { text: row.appealText, at: row.appealAt?.getTime() ?? 0 }
      : undefined,
    decision: row.decisionBy
      ? {
          by: row.decisionBy,
          at: row.decisionAt?.getTime() ?? 0,
          action: row.decisionAction ?? "",
          note: row.decisionNote ?? "",
        }
      : undefined,
  };
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function report(i: {
  room: string;
  uid: string;
  kind: "stream" | "user";
  reason: Reason;
  target?: string | null;
}): Promise<Res<{ status: "recorded" | "held" }>> {
  const room = await getRoom(i.room);
  if (!room) return { ok: false, code: 404, error: "no such room" };
  if (await isBanned(i.uid))
    return { ok: false, code: 403, error: "account restricted" };
  if (await isOwnerOrCrew(i.room, i.uid))
    return { ok: false, code: 403, error: "you cannot report your own room" };

  const sev = REASONS[i.reason].severe;
  const now = Date.now();

  // Rate limit: max perHour reports from this uid in the last hour
  const recentCount = await prisma.safetyReport.count({
    where: {
      uid: i.uid,
      createdAt: { gte: new Date(now - H) },
    },
  });
  if (recentCount >= cfg().perHour)
    return { ok: false, code: 429, error: "report limit reached, try again later" };

  const target =
    i.kind === "user" ? (i.target ?? "").slice(0, 32) || null : null;
  if (i.kind === "user" && !target)
    return { ok: false, code: 400, error: "who are you reporting?" };

  // Find open/appealed case for same room+kind+target
  let caseRow = await prisma.safetyCase.findFirst({
    where: {
      roomId: i.room,
      kind: i.kind,
      target,
      state: { in: ["open", "appealed"] },
    },
    include: { reporters: true },
  });

  if (caseRow?.reporters.some((r) => r.uid === i.uid))
    return { ok: false, code: 409, error: "you already reported this" };

  const weight = await weightOf(i.uid, i.room, sev);

  if (!caseRow) {
    caseRow = await prisma.safetyCase.create({
      data: {
        id: id(),
        kind: i.kind,
        roomId: i.room,
        ownerUid: room.ownerUid,
        target,
        reasons: [i.reason],
        severe: sev,
        state: "open",
        held: false,
        reporters: {
          create: {
            uid: i.uid,
            reason: i.reason,
            weight,
          },
        },
      },
      include: { reporters: true },
    });
  } else {
    const reasons = caseRow.reasons.includes(i.reason)
      ? caseRow.reasons
      : [...caseRow.reasons, i.reason];
    await prisma.safetyReport.create({
      data: {
        caseId: caseRow.id,
        uid: i.uid,
        reason: i.reason,
        weight,
      },
    });
    caseRow = await prisma.safetyCase.update({
      where: { id: caseRow.id },
      data: {
        reasons,
        severe: caseRow.severe || sev,
      },
      include: { reporters: true },
    });
  }

  const c = toCase(caseRow);
  const total = Object.values(c.reporters).reduce((a, r) => a + r.weight, 0);
  const valid = Object.values(c.reporters).some((r) => r.weight > 0);
  const trip = c.severe ? valid : total >= FLAG_LIMIT;

  if (trip && !c.held && c.state === "open") {
    await prisma.safetyCase.update({
      where: { id: c.id },
      data: { held: true },
    });
    c.held = true;
    if (c.kind === "stream") {
      await setSuspended(c.room, true);
      await audit("system", "auto-hold", { case: c.id, room: c.room, total });
    } else if (c.target) {
      const u = uidOfHandle(c.room, c.target);
      if (u) {
        await prisma.roomMute.upsert({
          where: { roomId_uid: { roomId: c.room, uid: u } },
          create: { roomId: c.room, uid: u },
          update: {},
        });
        await audit("system", "auto-mute", {
          case: c.id,
          room: c.room,
          target: c.target,
        });
      }
    }
  }

  if (c.kind === "stream") {
    await setFlags(
      c.room,
      Object.entries(c.reporters)
        .filter(([, r]) => r.weight > 0)
        .map(([u]) => u)
    );
  }

  return { ok: true, status: c.held ? "held" : "recorded" };
}

// handle → uid, supplied by the chat module (set once to avoid a cycle)
let uidOfHandle: (room: string, handle: string) => string | null = () => null;
export const bindChat = (f: typeof uidOfHandle) => {
  uidOfHandle = f;
};

// ─── Moderators ─────────────────────────────────────────────────────────────

async function stat(uids: string[], field: "upheld" | "dismissed") {
  for (const uid of uids) {
    await prisma.reporterStats.upsert({
      where: { uid },
      create: {
        uid,
        upheld: field === "upheld" ? 1 : 0,
        dismissed: field === "dismissed" ? 1 : 0,
      },
      update: {
        [field]: { increment: 1 },
      },
    });
  }
}

export async function decide(
  caseId: string,
  mod: string,
  action: "dismiss" | "uphold" | "ban" | "reinstate" | "mute" | "roomban",
  note: string
): Promise<Res<{ case: Case }>> {
  const row = await prisma.safetyCase.findUnique({
    where: { id: caseId },
    include: { reporters: true },
  });
  if (!row) return { ok: false, code: 404, error: "no such case" };
  if (row.ownerUid === mod)
    return { ok: false, code: 403, error: "conflict of interest" };
  if (row.state !== "open" && row.state !== "appealed")
    return { ok: false, code: 409, error: "case already closed" };

  const c = toCase(row);
  const reporters = Object.keys(c.reporters);
  const own = c.ownerUid;

  const finish = async (state: CaseState): Promise<Res<{ case: Case }>> => {
    const updated = await prisma.safetyCase.update({
      where: { id: c.id },
      data: {
        state,
        held: c.held,
        restoreAt: c.restoreAt ? new Date(c.restoreAt) : null,
        decisionBy: mod,
        decisionAt: new Date(),
        decisionAction: action,
        decisionNote: note.slice(0, 300),
      },
      include: { reporters: true },
    });
    await audit(mod, action, { case: c.id, room: c.room });
    return { ok: true, case: toCase(updated) };
  };

  if (c.kind === "stream") {
    if (action === "dismiss" || action === "reinstate") {
      await setSuspended(c.room, false);
      c.held = false;
      c.restoreAt = null;
      if (action === "dismiss") await stat(reporters, "dismissed");
      else if (own) {
        const strike = await prisma.accountStrike.findUnique({
          where: { uid: own },
        });
        const next = Math.max(0, (strike?.count ?? 1) - 1);
        await prisma.accountStrike.upsert({
          where: { uid: own },
          create: { uid: own, count: next },
          update: { count: next },
        });
      }
      return finish(action === "dismiss" ? "dismissed" : "reinstated");
    }
    if (action === "uphold" || action === "ban") {
      await stat(reporters, "upheld");
      await setSuspended(c.room, true);
      c.held = true;
      if (own) {
        const strike = await prisma.accountStrike.findUnique({
          where: { uid: own },
        });
        const n = (strike?.count ?? 0) + 1;
        await prisma.accountStrike.upsert({
          where: { uid: own },
          create: { uid: own, count: n },
          update: { count: n },
        });
        if (action === "ban" || c.severe)
          await ban(own, null, "upheld: " + c.reasons.join(", "), mod);
        else if (n >= 3)
          await ban(own, Date.now() + 30 * D, "3 strikes", mod);
        c.restoreAt = (await isBanned(own))
          ? null
          : Date.now() + (n === 1 ? D : 7 * D);
      }
      return finish("upheld");
    }
  } else {
    const u = c.target ? uidOfHandle(c.room, c.target) : null;
    if (action === "dismiss") {
      if (u)
        await prisma.roomMute
          .delete({ where: { roomId_uid: { roomId: c.room, uid: u } } })
          .catch(() => {});
      await stat(reporters, "dismissed");
      c.held = false;
      return finish("dismissed");
    }
    if (action === "mute") {
      if (u)
        await prisma.roomMute.upsert({
          where: { roomId_uid: { roomId: c.room, uid: u } },
          create: { roomId: c.room, uid: u },
          update: {},
        });
      await stat(reporters, "upheld");
      return finish("upheld");
    }
    if (action === "roomban") {
      if (u)
        await prisma.roomBan.upsert({
          where: { roomId_uid: { roomId: c.room, uid: u } },
          create: { roomId: c.room, uid: u },
          update: {},
        });
      await stat(reporters, "upheld");
      return finish("upheld");
    }
    if (action === "ban") {
      if (u) await ban(u, null, "upheld: " + c.reasons.join(", "), mod);
      await stat(reporters, "upheld");
      return finish("upheld");
    }
  }
  return { ok: false, code: 400, error: "action does not apply to this case" };
}

export async function appeal(
  caseId: string,
  uid: string,
  text: string
): Promise<Res> {
  const row = await prisma.safetyCase.findUnique({ where: { id: caseId } });
  if (!row || row.ownerUid !== uid || row.kind !== "stream")
    return { ok: false, code: 404, error: "no such case" };
  if (
    row.state !== "upheld" &&
    !(row.state === "open" && row.held)
  )
    return { ok: false, code: 409, error: "nothing to appeal" };
  if (row.appealText)
    return { ok: false, code: 409, error: "already appealed" };
  if (!text.trim()) return { ok: false, code: 400, error: "say why" };

  await prisma.safetyCase.update({
    where: { id: caseId },
    data: {
      appealText: text.trim().slice(0, 500),
      appealAt: new Date(),
      state: "appealed",
    },
  });
  await audit(uid, "appeal", { case: caseId });
  return { ok: true };
}

/** Expire timed holds. Safe to call on every hubs poll (serverless-friendly). */
export async function tick(): Promise<void> {
  const now = new Date();
  const due = await prisma.safetyCase.findMany({
    where: {
      kind: "stream",
      state: "upheld",
      restoreAt: { lt: now },
    },
  });
  for (const c of due) {
    if (await isBanned(c.ownerUid ?? undefined)) continue;
    await setSuspended(c.roomId, false);
    await prisma.safetyCase.update({
      where: { id: c.id },
      data: { held: false, state: "expired" },
    });
    await audit("system", "restore", { case: c.id, room: c.roomId });
  }
}

export async function queue() {
  await tick();
  const rows = await prisma.safetyCase.findMany({
    where: { state: { in: ["open", "appealed"] } },
    include: { reporters: true },
    orderBy: { openedAt: "asc" },
  });
  const rank = (c: Case) => (c.severe ? 0 : c.state === "appealed" ? 1 : 2);
  return rows
    .map(toCase)
    .sort((a, b) => rank(a) - rank(b) || a.opened - b.opened)
    .map((c) => ({
      ...c,
      total: Object.values(c.reporters).reduce((s, r) => s + r.weight, 0),
      reporters: Object.keys(c.reporters).length,
    }));
}

export async function mine(uid: string) {
  await tick();
  const rooms = await roomsOwnedBy(uid);
  const banned = (await isBanned(uid)) ? await banInfo(uid) : null;
  const strike = await prisma.accountStrike.findUnique({ where: { uid } });
  const cases = await prisma.safetyCase.findMany({
    where: {
      kind: "stream",
      roomId: { in: rooms },
      OR: [{ held: true }, { state: { in: ["upheld", "appealed"] } }],
    },
    include: { reporters: true },
  });
  return {
    banned,
    strikes: strike?.count ?? 0,
    cases: cases.map((row) => {
      const c = toCase(row);
      return {
        id: c.id,
        room: c.room,
        state: c.state,
        reasons: c.reasons.map((r) => REASONS[r].label),
        restoreAt: c.restoreAt,
        appeal: !!c.appeal,
        canAppeal:
          !c.appeal &&
          (c.state === "upheld" || (c.held && c.state === "open")),
        note: c.decision?.note ?? null,
      };
    }),
  };
}

// ─── Owner / moderator room controls ────────────────────────────────────────

export async function roomControl(
  room: string,
  op: "mute" | "unmute" | "ban" | "unban",
  uid: string,
  by: string
): Promise<Res> {
  if (await isOwnerOrCrew(room, uid))
    return { ok: false, code: 403, error: "cannot act on the host or crew" };

  if (op === "mute") {
    await prisma.roomMute.upsert({
      where: { roomId_uid: { roomId: room, uid } },
      create: { roomId: room, uid },
      update: {},
    });
  } else if (op === "unmute") {
    await prisma.roomMute
      .delete({ where: { roomId_uid: { roomId: room, uid } } })
      .catch(() => {});
  } else if (op === "ban") {
    await prisma.roomBan.upsert({
      where: { roomId_uid: { roomId: room, uid } },
      create: { roomId: room, uid },
      update: {},
    });
  } else if (op === "unban") {
    await prisma.roomBan
      .delete({ where: { roomId_uid: { roomId: room, uid } } })
      .catch(() => {});
  }
  await audit(by, op, { room, uid });
  return { ok: true };
}

/** Test helper — clears durable tables (use only in tests with a test DB). */
export async function _reset() {
  await prisma.safetyReport.deleteMany();
  await prisma.safetyCase.deleteMany();
  await prisma.accountBan.deleteMany();
  await prisma.accountStrike.deleteMany();
  await prisma.roomMute.deleteMany();
  await prisma.roomBan.deleteMany();
  await prisma.reporterStats.deleteMany();
  await prisma.safetyAudit.deleteMany();
  await prisma.accountSeen.deleteMany();
  await prisma.roomDwell.deleteMany();
  lastMsg.clear();
}
