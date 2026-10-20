/**
 * Live chat per room.
 * - Messages + mic state persist in Postgres (last 200 lines kept).
 * - Live delivery: Supabase Realtime HTTP broadcast when service role is set;
 *   clients also poll GET /api/chat/[room] as a free-tier-safe fallback.
 * - System messages are authored only by the server.
 */
import { prisma } from "./db";

export type Msg = {
  id: string;
  room: string;
  kind: "text" | "system";
  by: string;
  text: string;
  t: number;
  question?: boolean;
};

const MAX_LOG = 200;
const SAY_COOLDOWN_MS = 700;

const id = () => Math.random().toString(36).slice(2);
const clean = (t: string) =>
  t.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 240);

const g = globalThis as any;
const lastSay: Map<string, number> = (g.__guildChatLast ??= new Map());
/** handle→uid cache so safety.bindChat can stay sync */
const handleCache: Map<string, string> = (g.__guildChatHandleCache ??= new Map());

async function rememberHandle(room: string, handle: string, uid: string) {
  handleCache.set(`${room}|${handle}`, uid);
  await prisma.chatHandle.upsert({
    where: { roomId_handle: { roomId: room, handle } },
    create: { roomId: room, handle, uid },
    update: { uid },
  });
}

async function trimLog(room: string) {
  const count = await prisma.chatMessage.count({ where: { roomId: room } });
  if (count <= MAX_LOG) return;
  const overflow = count - MAX_LOG;
  const old = await prisma.chatMessage.findMany({
    where: { roomId: room },
    orderBy: { createdAt: "asc" },
    take: overflow,
    select: { id: true },
  });
  if (old.length) {
    await prisma.chatMessage.deleteMany({
      where: { id: { in: old.map((r) => r.id) } },
    });
  }
}

async function push(room: string, m: Msg, uid?: string | null): Promise<Msg> {
  await prisma.chatMessage.create({
    data: {
      id: m.id,
      roomId: room,
      kind: m.kind,
      by: m.by,
      uid: uid ?? null,
      text: m.text,
      question: !!m.question,
      createdAt: new Date(m.t),
    },
  });
  void trimLog(room);
  await broadcast(room, "msg", m);
  return m;
}

async function micState(room: string) {
  const row = await prisma.chatMicState.findUnique({ where: { roomId: room } });
  return {
    requests: row?.requests ?? [],
    slots: row?.slots ?? [],
  };
}

async function setMic(
  room: string,
  requests: string[],
  slots: string[]
): Promise<void> {
  await prisma.chatMicState.upsert({
    where: { roomId: room },
    create: { roomId: room, requests, slots },
    update: { requests, slots },
  });
  await broadcast(room, "mic", { requests, slots });
}

/** Best-effort Realtime broadcast. No-op when service role is not configured. */
async function broadcast(
  room: string,
  event: "msg" | "mic",
  payload: unknown
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `room:${room}`,
            event,
            payload,
            private: false,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[chat] broadcast failed:", err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function say(
  room: string,
  uid: string,
  handle: string,
  text: string
): Promise<Msg | null> {
  const t = clean(text);
  const now = Date.now();
  if (!t) return null;
  const key = `${room}:${uid}`;
  if (now - (lastSay.get(key) ?? 0) < SAY_COOLDOWN_MS) return null;
  lastSay.set(key, now);

  await rememberHandle(room, handle, uid);
  const m: Msg = {
    id: id(),
    room,
    kind: "text",
    by: handle,
    text: t,
    t: now,
    question: t.includes("?") && t.length > 24,
  };
  return push(room, m, uid);
}

export async function system(room: string, text: string): Promise<Msg> {
  const m: Msg = {
    id: id(),
    room,
    kind: "system",
    by: "system",
    text: clean(text),
    t: Date.now(),
  };
  return push(room, m, null);
}

export async function requestMic(
  room: string,
  uid: string,
  handle: string
): Promise<void> {
  await rememberHandle(room, handle, uid);
  const { requests, slots } = await micState(room);
  if (requests.includes(handle) || slots.includes(handle)) return;
  await setMic(room, [...requests, handle], slots);
  await system(room, `@${handle} requested the mic`);
}

export async function cancelMicRequest(
  room: string,
  uid: string,
  handle: string
): Promise<boolean> {
  const mapped = await prisma.chatHandle.findUnique({
    where: { roomId_handle: { roomId: room, handle } },
  });
  if (!mapped || mapped.uid !== uid) return false;
  const { requests, slots } = await micState(room);
  if (!requests.includes(handle)) return false;
  await setMic(
    room,
    requests.filter((h) => h !== handle),
    slots
  );
  await system(room, `@${handle} cancelled mic request`);
  return true;
}

export async function passMic(
  room: string,
  handle: string
): Promise<string | null> {
  const mapped = await prisma.chatHandle.findUnique({
    where: { roomId_handle: { roomId: room, handle } },
  });
  if (!mapped) return null;
  handleCache.set(`${room}|${handle}`, mapped.uid);
  const { requests, slots } = await micState(room);
  if (slots.length >= 2) return null;
  await setMic(
    room,
    requests.filter((h) => h !== handle),
    slots.includes(handle) ? slots : [...slots, handle]
  );
  await system(room, `@${handle} was passed the mic`);
  return mapped.uid;
}

export async function revokeMic(
  room: string,
  handle: string
): Promise<string | null> {
  const mapped = await prisma.chatHandle.findUnique({
    where: { roomId_handle: { roomId: room, handle } },
  });
  const { requests, slots } = await micState(room);
  if (!slots.includes(handle)) return mapped?.uid ?? null;
  await setMic(
    room,
    requests,
    slots.filter((h) => h !== handle)
  );
  return mapped?.uid ?? null;
}

/** Sync lookup for safety.bindChat — uses cache populated on speak/mic actions. */
export function uidOf(room: string, handle: string): string | null {
  return handleCache.get(`${room}|${handle}`) ?? null;
}

export async function hasSlot(room: string, uid: string): Promise<boolean> {
  const { slots } = await micState(room);
  if (!slots.length) return false;
  const handles = await prisma.chatHandle.findMany({
    where: { roomId: room, handle: { in: slots } },
    select: { uid: true },
  });
  return handles.some((h) => h.uid === uid);
}

export async function snapshot(room: string): Promise<{
  log: Msg[];
  requests: string[];
  slots: string[];
}> {
  const rows = await prisma.chatMessage.findMany({
    where: { roomId: room },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  // Warm handle cache from recent speakers
  const withUid = await prisma.chatHandle.findMany({
    where: { roomId: room },
    take: 100,
  });
  for (const h of withUid) handleCache.set(`${room}|${h.handle}`, h.uid);

  const log: Msg[] = rows
    .reverse()
    .map((r) => ({
      id: r.id,
      room: r.roomId,
      kind: r.kind as "text" | "system",
      by: r.by,
      text: r.text,
      t: r.createdAt.getTime(),
      question: r.question || undefined,
    }));
  const mic = await micState(room);
  return { log, ...mic };
}
