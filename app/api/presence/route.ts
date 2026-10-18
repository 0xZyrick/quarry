import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { readSession } from "@/lib/server/session";
import { isMissingSchemaError, MISSING_COLLABORATION_SCHEMA } from "@/lib/server/prismaErrors";


/** Active if lastSeen within this window */
const ACTIVE_MS = 45_000;

/**
 * GET /api/presence?roomId=
 * Returns active peers in the room.
 */
export async function GET(req: NextRequest) {
  const roomId = new URL(req.url).searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  try {
    const since = new Date(Date.now() - ACTIVE_MS);
    const rows = await (prisma as any).roomPresence.findMany({
      where: { roomId, lastSeenAt: { gte: since } },
      orderBy: { joinedAt: "asc" },
      take: 48,
    });
    return NextResponse.json({
      roomId,
      count: rows.length,
      peers: rows.map((r: any) => ({
        userId: r.userId,
        handle: r.handle,
        lastSeenAt: r.lastSeenAt,
      })),
    });
  } catch (e) {
    console.error("GET /api/presence", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load room presence." }, { status: 500 });
  }
}

/**
 * POST — heartbeat join
 * { roomId, userId, handle? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { roomId } = body;
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to join room presence." }, { status: 401 });
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }
  const userId = session.uid;
  const handle = session.handle;

  try {
    const row = await (prisma as any).roomPresence.upsert({
      where: { roomId_userId: { roomId: String(roomId), userId: String(userId) } },
      create: {
        roomId: String(roomId),
        userId: String(userId),
        handle: handle ? String(handle).replace(/^@/, "") : null,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        ...(handle ? { handle: String(handle).replace(/^@/, "") } : {}),
      },
    });

    const since = new Date(Date.now() - ACTIVE_MS);
    const count = await (prisma as any).roomPresence.count({
      where: { roomId: String(roomId), lastSeenAt: { gte: since } },
    });

    return NextResponse.json({ ok: true, presence: row, count });
  } catch (e) {
    console.error("POST /api/presence", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not update room presence." }, { status: 500 });
  }
}

/**
 * DELETE — leave room
 * body: { roomId, userId }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { roomId } = body;
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to leave room presence." }, { status: 401 });
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }
  try {
    await (prisma as any).roomPresence.deleteMany({
      where: { roomId: String(roomId), userId: session.uid },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/presence", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not leave room presence." }, { status: 500 });
  }
}
