import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { readSession } from "@/lib/server/session";
import { isMissingSchemaError, MISSING_COLLABORATION_SCHEMA } from "@/lib/server/prismaErrors";

const prisma = new PrismaClient();
const MAX_COTEAM = 3;
const ACTIVE_MS = 90_000;

function helpModel() {
  return (prisma as any).helpRequest;
}

async function isPresent(roomId: string, userId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - ACTIVE_MS);
    const row = await (prisma as any).roomPresence.findFirst({
      where: {
        roomId: String(roomId),
        userId: String(userId),
        lastSeenAt: { gte: since },
      },
    });
    return !!row;
  } catch {
    return false;
  }
}

async function handlesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, handle: true },
  });
  return new Map(users.map((u) => [u.id, u.handle || u.id.slice(0, 8)]));
}

function serialize(h: any, handleById: Map<string, string>) {
  const pendingIds: string[] = h.pendingIds || [];
  const acceptedIds: string[] = h.acceptedIds || [];
  return {
    id: h.id,
    title: h.title,
    body: h.body,
    tags: h.tags || [],
    status: h.status,
    projectId: h.projectId,
    projectTitle: h.project?.title,
    handle: h.project?.creator?.handle || "anon",
    creatorId: h.creatorId,
    roomId: h.roomId || h.projectId,
    sessionId: h.sessionId || null,
    nodeId: h.nodeId,
    claimedById: h.claimedById,
    claimedByHandle: h.claimedById ? handleById.get(h.claimedById) || null : null,
    claimedAt: h.claimedAt,
    pendingIds,
    acceptedIds,
    pending: pendingIds.map((id) => ({
      id,
      handle: handleById.get(id) || id.slice(0, 8),
    })),
    coTeam: acceptedIds.map((id) => ({
      id,
      handle: handleById.get(id) || id.slice(0, 8),
    })),
    seatsOpen: Math.max(0, MAX_COTEAM - acceptedIds.length),
    createdAt: h.createdAt,
    closedAt: h.closedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const model = helpModel();
    if (!model?.findMany) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "OPEN";
    const projectId = searchParams.get("projectId");
    const roomId = searchParams.get("roomId");
    const take = Math.min(40, Math.max(1, Number(searchParams.get("take") || 24)));

    const rows = await model.findMany({
      where: {
        ...(status === "ACTIVE"
          ? { status: { in: ["OPEN", "IN_PROGRESS"] } }
          : status !== "ALL"
            ? { status }
            : {}),
        ...(projectId ? { projectId } : {}),
        ...(roomId ? { roomId: String(roomId) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            creator: { select: { id: true, handle: true } },
          },
        },
      },
    });

    const allIds = new Set<string>();
    for (const h of rows) {
      if (h.claimedById) allIds.add(h.claimedById);
      for (const id of h.pendingIds || []) allIds.add(id);
      for (const id of h.acceptedIds || []) allIds.add(id);
    }
    const handleById = await handlesFor([...allIds]);

    return NextResponse.json({
      help: rows.map((h: any) => serialize(h, handleById)),
      maxCoTeam: MAX_COTEAM,
    });
  } catch (e) {
    console.error("GET /api/help", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load help requests." }, { status: 500 });
  }
}

/**
 * POST — host posts Needs a hand FROM INSIDE the room only.
 * { projectId, roomId, title, body?, tags?, nodeId?, sessionId? }
 */
export async function POST(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to post a help request." }, { status: 401 });
  const model = helpModel();
  if (!model?.create) {
    return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId, title, body: text, tags, nodeId, sessionId } = body;
  const roomId = String(body.roomId || projectId || "");
  if (!projectId || !title?.trim()) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }
  if (!roomId) {
    return NextResponse.json({ error: "roomId required — post Needs a hand from inside the update room." }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, creatorId: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.creatorId !== session.uid) {
      return NextResponse.json({ error: "Only the project host can post Needs a hand." }, { status: 403 });
    }

    // Must be present in the room (anti-spam: no homepage fire-and-forget)
    const present = await isPresent(roomId, session.uid);
    if (!present) {
      return NextResponse.json(
        { error: "Join the update room first, then post Needs a hand from there." },
        { status: 403 }
      );
    }

    // One open ask per project at a time
    const existingOpen = await model.findFirst({
      where: {
        projectId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    });
    if (existingOpen) {
      return NextResponse.json(
        { error: "You already have an open Needs a hand on this update. Close it first." },
        { status: 409 }
      );
    }

    const help = await model.create({
      data: {
        projectId,
        roomId,
        sessionId: sessionId ? String(sessionId) : null,
        nodeId: nodeId || null,
        creatorId: session.uid,
        title: String(title).trim().slice(0, 120),
        body: text ? String(text).trim().slice(0, 280) : null,
        tags: Array.isArray(tags) ? tags.slice(0, 6).map(String) : [],
        status: "OPEN",
        pendingIds: [],
        acceptedIds: [],
      },
    });

    return NextResponse.json({ help: serialize(help, new Map()), maxCoTeam: MAX_COTEAM }, { status: 201 });
  } catch (error) {
    console.error("POST /api/help", error);
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not post the help request." }, { status: 500 });
  }
}

/**
 * PATCH actions:
 * - { id, claim: true }           helper requests a seat (pending)
 * - { id, accept: userId }        host accepts → co-team (max 3)
 * - { id, drop: userId }          host removes from co-team / pending
 * - { id, status: CLOSED|... }    host closes ask
 * - { id, expire: true }          system/host expire (leave room)
 */
export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const model = helpModel();
  if (!model?.findUnique) {
    return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, status, claim, accept, drop, expire } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let existing: any;
  try {
    existing = await model.findUnique({
      where: { id: String(id) },
      include: {
        project: { select: { id: true, title: true, creatorId: true } },
      },
    });
  } catch (error) {
    console.error("PATCH /api/help lookup", error);
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load this help request." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Help request not found" }, { status: 404 });

  const isHost = existing.project.creatorId === session.uid || existing.creatorId === session.uid;
  const pendingIds: string[] = [...(existing.pendingIds || [])];
  const acceptedIds: string[] = [...(existing.acceptedIds || [])];

  // --- Expire / close when host leaves or ends ---
  if (expire === true || status === "CLOSED" || status === "RESOLVED") {
    if (!isHost && expire !== true) {
      return NextResponse.json({ error: "Only the host can close this ask." }, { status: 403 });
    }
    // Allow expire from presence leave for host
    if (expire === true && !isHost) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const help = await model.update({
      where: { id: String(id) },
      data: {
        status: status === "RESOLVED" ? "RESOLVED" : "CLOSED",
        closedAt: new Date(),
        pendingIds: [],
      },
    });
    // acceptedIds kept as roster credit
    const handleById = await handlesFor([
      ...(help.acceptedIds || []),
      ...(help.claimedById ? [help.claimedById] : []),
    ]);
    return NextResponse.json({ help: serialize(help, handleById) });
  }

  // --- Helper: request a seat ---
  if (claim === true) {
    if (isHost) {
      return NextResponse.json({ error: "You cannot claim your own request." }, { status: 400 });
    }
    if (existing.status !== "OPEN" && existing.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "This ask is closed." }, { status: 409 });
    }
    if (acceptedIds.includes(session.uid) || pendingIds.includes(session.uid)) {
      return NextResponse.json({ error: "Already in queue or on the table." }, { status: 409 });
    }
    if (acceptedIds.length >= MAX_COTEAM) {
      return NextResponse.json({ error: "Co-team is full (max 3). Host can drop someone first." }, { status: 409 });
    }
    // Must be in the room to claim
    const room = existing.roomId || existing.projectId;
    if (!(await isPresent(room, session.uid))) {
      return NextResponse.json(
        { error: "Enter the update room before offering help." },
        { status: 403 }
      );
    }
    pendingIds.push(session.uid);
    const help = await model.update({
      where: { id: String(id) },
      data: {
        pendingIds,
        status: "IN_PROGRESS",
        // legacy field: first claimer
        claimedById: existing.claimedById || session.uid,
        claimedAt: existing.claimedAt || new Date(),
      },
    });
    try {
      await prisma.notification.create({
        data: {
          userId: existing.project.creatorId,
          type: "help_claimed",
          title: "Someone wants to help",
          body: `@${session.handle} asked to join co-team on "${existing.title}".`,
          href: `room:${existing.projectId}`,
          meta: JSON.stringify({ helpId: help.id, claimerId: session.uid }),
        },
      });
    } catch (error) {
      console.error("Could not notify host of help claim", error);
    }
    const handleById = await handlesFor([...pendingIds, ...acceptedIds]);
    return NextResponse.json({ help: serialize(help, handleById) });
  }

  // --- Host: accept pending → co-team ---
  if (accept) {
    if (!isHost) return NextResponse.json({ error: "Only the host can accept helpers." }, { status: 403 });
    const uid = String(accept);
    if (acceptedIds.length >= MAX_COTEAM) {
      return NextResponse.json({ error: "Co-team full (max 3). Drop someone first." }, { status: 409 });
    }
    if (acceptedIds.includes(uid)) {
      return NextResponse.json({ error: "Already on co-team." }, { status: 409 });
    }
    const nextPending = pendingIds.filter((x) => x !== uid);
    // allow accept even if not pending (host invite)
    const nextAccepted = [...acceptedIds, uid];
    const help = await model.update({
      where: { id: String(id) },
      data: {
        pendingIds: nextPending,
        acceptedIds: nextAccepted,
        status: "IN_PROGRESS",
      },
    });
    const handleById = await handlesFor([...nextPending, ...nextAccepted]);
    return NextResponse.json({ help: serialize(help, handleById) });
  }

  // --- Host: drop from pending or co-team ---
  if (drop) {
    if (!isHost) return NextResponse.json({ error: "Only the host can drop helpers." }, { status: 403 });
    const uid = String(drop);
    const help = await model.update({
      where: { id: String(id) },
      data: {
        pendingIds: pendingIds.filter((x) => x !== uid),
        acceptedIds: acceptedIds.filter((x) => x !== uid),
      },
    });
    const handleById = await handlesFor([
      ...(help.pendingIds || []),
      ...(help.acceptedIds || []),
    ]);
    return NextResponse.json({ help: serialize(help, handleById) });
  }

  if (status === "OPEN") {
    if (!isHost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const help = await model.update({
      where: { id: String(id) },
      data: { status: "OPEN", claimedById: null, claimedAt: null, pendingIds: [] },
    });
    return NextResponse.json({ help: serialize(help, new Map()) });
  }

  return NextResponse.json({ error: "id and claim|accept|drop|status|expire required" }, { status: 400 });
}
