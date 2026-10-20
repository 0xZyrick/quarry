import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { detectPlatform, parseStreamUrl, resolveVodUrl } from "@/lib/streamEmbed";
import { dayKey } from "@/lib/activityGrid";
import { readSession } from "@/lib/server/session";
import { unlockedStudioSession } from "@/lib/server/studioAccess";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const roomId = searchParams.get("roomId");
    const sessions = await prisma.workSession.findMany({
      where: active === "1" || roomId
        ? {
            isActive: true,
            ...(active === "1" ? { mode: "LIVE" as const, visibility: "PUBLIC" as const } : {}),
            ...(roomId ? { roomId } : {}),
          }
        : undefined,
      include: active === "1" ? {
        project: {
          select: {
            title: true,
            creator: { select: { handle: true } },
            journeyNodes: {
              orderBy: { position: "desc" },
              take: 1,
              select: { nextSnapshotUrl: true, prevSnapshotUrl: true },
            },
          },
        },
      } : undefined,
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return NextResponse.json({ sessions });
  } catch (e) {
    console.error("GET /api/sessions", e);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(req: NextRequest) {
  const accountSession = await unlockedStudioSession(req);
  if (!accountSession) return NextResponse.json({ error: "Unlock Studio before starting a session." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const {
    creatorId,
    projectId,
    journeyNodeId,
    title,
    goal,
    currentState,
    nextStep,
    visibility,
    mode,
    roomId,
    liveUrl: liveUrlRaw,
  } = body;

  if (!creatorId || !title)
    return NextResponse.json({ error: "creatorId and title required" }, { status: 400 });
  if (creatorId !== accountSession.uid) return NextResponse.json({ error: "You can only start your own session." }, { status: 403 });

  const liveUrl =
    typeof liveUrlRaw === "string" && liveUrlRaw.trim().length > 8 ? liveUrlRaw.trim() : null;
  if (liveUrl && !parseStreamUrl(liveUrl)) {
    return NextResponse.json({ error: "Invalid liveUrl" }, { status: 400 });
  }

  await prisma.workSession.updateMany({
    where: { creatorId, isActive: true, mode: "LIVE" },
    data: { isActive: false, endedAt: new Date() },
  });

  const livePlatform = liveUrl ? detectPlatform(liveUrl) : null;

  const workSession = await prisma.workSession.create({
    data: {
      creatorId,
      projectId: projectId || null,
      journeyNodeId: journeyNodeId || null,
      title: String(title).trim(),
      goal: goal ? String(goal).trim() : null,
      currentState: currentState ? String(currentState).trim() : null,
      nextStep: nextStep ? String(nextStep).trim() : null,
      visibility: visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      mode: mode === "RECORDED" ? "RECORDED" : mode === "PROGRESS_UPDATE" ? "PROGRESS_UPDATE" : "LIVE",
      roomId: roomId || projectId || null,
      liveUrl,
      livePlatform,
      isActive: true,
    },
  });

  if (journeyNodeId && liveUrl) {
    await prisma.journeyNode
      .update({
        where: { id: String(journeyNodeId) },
        data: {
          liveUrl,
          livePlatform,
          sessionStartedAt: new Date(),
          sessionEndedAt: null,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ session: workSession }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to end this session." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { sessionId, roomId, creatorId, endAll, vodUrl: vodUrlRaw } = body;

  let vodUrl =
    typeof vodUrlRaw === "string" && vodUrlRaw.trim().length > 8 ? vodUrlRaw.trim() : null;

  const endData: { isActive: false; endedAt: Date; vodUrl?: string } = {
    isActive: false,
    endedAt: new Date(),
  };

  if (endAll && creatorId) {
    if (String(creatorId) !== session.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const r = await prisma.workSession.updateMany({
      where: { creatorId: String(creatorId), isActive: true },
      data: endData,
    });
    return NextResponse.json({ ended: r.count });
  }

  if (sessionId) {
    const existing = await prisma.workSession.findUnique({ where: { id: String(sessionId) } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.creatorId !== session.uid) return NextResponse.json({ error: "Only the session owner can end it." }, { status: 403 });

    if (!vodUrl && existing.liveUrl) {
      vodUrl = await resolveVodUrl({
        platform: (existing.livePlatform as any) || "other",
        liveUrl: existing.liveUrl,
        sessionStartedAt: existing.createdAt,
      });
    }
    if (vodUrl) endData.vodUrl = vodUrl;

    const s = await prisma.workSession.update({
      where: { id: String(sessionId) },
      data: endData,
    });

    // Activity grid: one ship per ended session (date only)
    try {
      await (prisma as any).sessionShip.create({
        data: {
          userId: existing.creatorId,
          projectId: existing.projectId,
          nodeId: existing.journeyNodeId,
          dayKey: dayKey(new Date()),
        },
      });
    } catch {}

    let node = null;
    if (existing.journeyNodeId) {
      node = await prisma.journeyNode
        .update({
          where: { id: existing.journeyNodeId },
          data: {
            sessionEndedAt: new Date(),
            ...(vodUrl ? { vodUrl } : {}),
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({ session: s, node, vodUrl });
  }

  if (roomId) {
    const active = await prisma.workSession.findMany({
      where: { roomId: String(roomId), isActive: true },
    });
    if (active.some((item) => item.creatorId !== session.uid)) {
      return NextResponse.json({ error: "Only the session owner can end it." }, { status: 403 });
    }
    const r = await prisma.workSession.updateMany({
      where: { roomId: String(roomId), isActive: true },
      data: endData,
    });
    for (const s of active) {
      if (s.journeyNodeId) {
        await prisma.journeyNode
          .update({
            where: { id: s.journeyNodeId },
            data: { sessionEndedAt: new Date() },
          })
          .catch(() => {});
      }
    }
    return NextResponse.json({ ended: r.count });
  }

  return NextResponse.json(
    { error: "sessionId, roomId, or endAll+creatorId required" },
    { status: 400 }
  );
}
