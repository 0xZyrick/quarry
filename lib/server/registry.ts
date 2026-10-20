/**
 * Server-side source of truth for rooms, crews, live state and flags.
 * Durable in Postgres (Supabase + Prisma). Seeded once with demo map nodes.
 */
import { NODES } from "../map";
import { shapeOf } from "../nodeShape";
import { seedLive } from "../seed";
import { canGoLive, Gate, RoomType } from "../access";
import type { Profile } from "../profile";
import type { Session } from "./session";
import { prisma } from "./db";

export type Room = {
  id: string;
  type: RoomType;
  ownerUid: string | null;
  crew: Set<string>;
  handle?: string;
};

/** What a creator declared at the Launch Portal. Only a zone id is kept, never a location. */
export type Meta = {
  title: string;
  tags: string[];
  env: "sandbox" | "focus";
  path: "digital" | "physical" | null;
  zone: string | null;
};

export type Hub = {
  live: boolean;
  gate: Gate | null;
  flags: Set<string>;
  suspended: boolean;
  greenroom: boolean;
  meta?: Meta;
};

export const ROOM_ID = /^[A-Za-z0-9:_-]{1,48}$/;

const OWNERS: Record<string, string> = { n1: "u-creator", n3: "u-co" };
const CREW: Record<string, string[]> = { n0: ["u-co"], n2: ["u-co"] };

// ─── Seed demo map nodes (idempotent) ───────────────────────────────────────

let seedPromise: Promise<void> | null = null;

async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const count = await prisma.guildRoom.count();
      if (count > 0) return;

      for (const n of NODES) {
        const type: RoomType = shapeOf(n) === "monolith" ? "war" : "commons";
        const ownerUid = OWNERS[n.id] ?? `demo-${n.id}`;
        const crew = CREW[n.id] ?? [];

        await prisma.guildRoom.upsert({
          where: { id: n.id },
          create: { id: n.id, type, ownerUid, handle: n.name },
          update: {},
        });
        await prisma.guildHub.upsert({
          where: { roomId: n.id },
          create: {
            roomId: n.id,
            live: seedLive(n.id),
            suspended: false,
            greenroom: false,
          },
          update: {},
        });
        for (const uid of crew) {
          await prisma.guildCrewMember.upsert({
            where: { roomId_uid: { roomId: n.id, uid } },
            create: { roomId: n.id, uid },
            update: {},
          });
        }
        // Node name → owner; reserved demo creator handles
        await prisma.guildHandle.upsert({
          where: { handle: n.name },
          create: { handle: n.name, uid: `demo-${n.id}` },
          update: {},
        });
      }
      for (const h of ["kodo.dev", "mio.3d", "acme.studio"]) {
        await prisma.guildHandle.upsert({
          where: { handle: h },
          create: { handle: h, uid: "demo" },
          update: {},
        });
      }
    } catch (err) {
      // Allow the process to keep running if DB is temporarily unreachable
      // (local without DATABASE_URL). Reset so a later request can retry.
      seedPromise = null;
      console.error("[registry] seed failed:", err);
      throw err;
    }
  })();
  return seedPromise;
}

// ─── Row mappers ────────────────────────────────────────────────────────────

function toRoom(
  row: {
    id: string;
    type: string;
    ownerUid: string | null;
    handle: string | null;
    crew?: { uid: string }[];
  }
): Room {
  return {
    id: row.id,
    type: (row.type === "war" ? "war" : "commons") as RoomType,
    ownerUid: row.ownerUid,
    handle: row.handle ?? undefined,
    crew: new Set((row.crew ?? []).map((c) => c.uid)),
  };
}

function toHub(row: {
  live: boolean;
  suspended: boolean;
  greenroom: boolean;
  gateCanvas: string | null;
  gateSkill: string | null;
  metaTitle: string | null;
  metaTags: string[];
  metaEnv: string | null;
  metaPath: string | null;
  metaZone: string | null;
  flagUids: string[];
}): Hub {
  const gate: Gate | null =
    row.gateCanvas || row.gateSkill
      ? { canvas: row.gateCanvas, skill: row.gateSkill }
      : null;
  const meta: Meta | undefined = row.metaTitle
    ? {
        title: row.metaTitle,
        tags: row.metaTags ?? [],
        env: row.metaEnv === "focus" ? "focus" : "sandbox",
        path:
          row.metaPath === "digital" || row.metaPath === "physical"
            ? row.metaPath
            : null,
        zone: row.metaZone,
      }
    : undefined;
  return {
    live: row.live,
    suspended: row.suspended,
    greenroom: row.greenroom,
    gate,
    flags: new Set(row.flagUids ?? []),
    meta,
  };
}

const EMPTY_HUB: Hub = {
  live: false,
  gate: null,
  flags: new Set(),
  suspended: false,
  greenroom: false,
};

// ─── Public API (all async) ─────────────────────────────────────────────────

/** A display name belongs to one account. Re-claiming your own name is fine. */
export async function claimHandle(handle: string, uid: string): Promise<boolean> {
  await ensureSeeded();
  const existing = await prisma.guildHandle.findUnique({ where: { handle } });
  if (existing && existing.uid !== uid) return false;
  await prisma.guildHandle.upsert({
    where: { handle },
    create: { handle, uid },
    update: { uid },
  });
  return true;
}

export async function getRoom(id: string): Promise<Room | null> {
  if (!ROOM_ID.test(id)) return null;
  await ensureSeeded();
  const row = await prisma.guildRoom.findUnique({
    where: { id },
    include: { crew: true },
  });
  return row ? toRoom(row) : null;
}

export async function hubOf(id: string): Promise<Hub> {
  await ensureSeeded();
  const row = await prisma.guildHub.findUnique({ where: { roomId: id } });
  return row ? toHub(row) : { ...EMPTY_HUB, flags: new Set() };
}

export async function ensureOwnRoom(s: Session): Promise<string> {
  await ensureSeeded();
  const id = `own:${s.uid.slice(-8)}`;
  const existing = await prisma.guildRoom.findUnique({ where: { id } });
  if (!existing) {
    await prisma.guildRoom.create({
      data: {
        id,
        type: "commons",
        ownerUid: s.uid,
        handle: s.handle,
        hub: {
          create: {
            live: false,
            suspended: false,
            greenroom: false,
          },
        },
      },
    });
  }
  return id;
}

const openClient = () => process.env.NODE_ENV !== "production";

export async function profileFor(s: Session | null): Promise<Profile | null> {
  if (!s) return null;
  await ensureSeeded();
  if (s.track === "creator") await ensureOwnRoom(s);

  const owned = await prisma.guildRoom.findMany({
    where: { ownerUid: s.uid },
    select: { id: true },
  });
  const crewRows = await prisma.guildCrewMember.findMany({
    where: { uid: s.uid },
    select: { roomId: true },
  });
  const account = await prisma.user.findUnique({
    where: { id: s.uid },
    select: { studioUnlocked: true },
  });

  let clientRoomIds: string[] = [];
  if (s.track === "client" && openClient()) {
    const war = await prisma.guildRoom.findMany({
      where: { type: "war" },
      select: { id: true },
    });
    clientRoomIds = war.map((r) => r.id);
  }

  return {
    id: s.uid,
    handle: s.handle,
    creatorNodeId: owned[0]?.id ?? null,
    clientRoomIds,
    crewRoomIds: crewRows.map((c) => c.roomId),
    studioUnlocked: account?.studioUnlocked ?? false,
  };
}

export async function addCrew(roomId: string, uid: string): Promise<void> {
  await ensureSeeded();
  const room = await prisma.guildRoom.findUnique({ where: { id: roomId } });
  if (!room) return;
  await prisma.guildCrewMember.upsert({
    where: { roomId_uid: { roomId, uid } },
    create: { roomId, uid },
    update: {},
  });
}

export async function removeCrew(roomId: string, uid: string): Promise<void> {
  await prisma.guildCrewMember.deleteMany({ where: { roomId, uid } });
}

export async function goLive(
  roomId: string,
  gate: Gate,
  meta?: Meta
): Promise<boolean> {
  await ensureSeeded();
  const hub = await prisma.guildHub.findUnique({ where: { roomId } });
  if (!hub || hub.suspended || !canGoLive(gate)) return false;

  await prisma.guildHub.update({
    where: { roomId },
    data: {
      live: true,
      gateCanvas: gate.canvas,
      gateSkill: gate.skill,
      ...(meta
        ? {
            metaTitle: meta.title,
            metaTags: meta.tags,
            metaEnv: meta.env,
            metaPath: meta.path,
            metaZone: meta.zone,
          }
        : {}),
    },
  });
  return true;
}

export async function goOffline(roomId: string): Promise<void> {
  await prisma.guildHub.updateMany({
    where: { roomId },
    data: { live: false },
  });
}

export async function setGreenroom(roomId: string, on: boolean): Promise<void> {
  await prisma.guildHub.updateMany({
    where: { roomId },
    data: { greenroom: on },
  });
}

/** Trust and safety decides when a room is hidden; the registry only stores the result. */
export async function setSuspended(id: string, on: boolean): Promise<void> {
  await prisma.guildHub.updateMany({
    where: { roomId: id },
    data: on
      ? { suspended: true, live: false }
      : { suspended: false, flagUids: [] },
  });
}

export async function setFlags(id: string, uids: string[]): Promise<void> {
  await prisma.guildHub.updateMany({
    where: { roomId: id },
    data: { flagUids: uids },
  });
}

export async function roomsOwnedBy(uid: string): Promise<string[]> {
  await ensureSeeded();
  const rows = await prisma.guildRoom.findMany({
    where: { ownerUid: uid },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function isOwnerOrCrew(
  roomId: string,
  uid: string
): Promise<boolean> {
  await ensureSeeded();
  const room = await prisma.guildRoom.findUnique({
    where: { id: roomId },
    include: { crew: { where: { uid }, take: 1 } },
  });
  if (!room) return false;
  return room.ownerUid === uid || room.crew.length > 0;
}

export async function snapshot(): Promise<{
  live: Record<string, boolean>;
  suspended: Record<string, boolean>;
  greenroom: Record<string, boolean>;
  flags: Record<string, number>;
  rooms: Record<string, Meta & { handle: string }>;
}> {
  await ensureSeeded();
  const hubs = await prisma.guildHub.findMany();
  const roomIds = hubs.map((h) => h.roomId);
  const rooms = await prisma.guildRoom.findMany({
    where: { id: { in: roomIds } },
    select: { id: true, handle: true },
  });
  const handleById = new Map(rooms.map((r) => [r.id, r.handle]));

  const live: Record<string, boolean> = {};
  const suspended: Record<string, boolean> = {};
  const greenroom: Record<string, boolean> = {};
  const flags: Record<string, number> = {};
  const launched: Record<string, Meta & { handle: string }> = {};

  for (const h of hubs) {
    live[h.roomId] = h.live;
    suspended[h.roomId] = h.suspended;
    greenroom[h.roomId] = h.greenroom;
    flags[h.roomId] = (h.flagUids ?? []).length;
    const handle = handleById.get(h.roomId);
    if (h.metaTitle && handle && h.roomId.startsWith("own:")) {
      launched[h.roomId] = {
        title: h.metaTitle,
        tags: h.metaTags ?? [],
        env: h.metaEnv === "focus" ? "focus" : "sandbox",
        path:
          h.metaPath === "digital" || h.metaPath === "physical"
            ? h.metaPath
            : null,
        zone: h.metaZone,
        handle,
      };
    }
  }
  return { live, suspended, greenroom, flags, rooms: launched };
}
