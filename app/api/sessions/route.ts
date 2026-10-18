import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { detectPlatform, parseStreamUrl, resolveVodUrl } from "@/lib/streamEmbed";
import { dayKey } from "@/lib/activityGrid";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const sessions = await prisma.workSession.findMany({
      where: active === "1" ? { isActive: true, mode: "LIVE", visibility: "PUBLIC" } : undefined,
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

  const session = await prisma.workSession.create({
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

  return NextResponse.json({ session }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sessionId, roomId, creatorId, endAll, vodUrl: vodUrlRaw } = body;

  let vodUrl =
    typeof vodUrlRaw === "string" && vodUrlRaw.trim().length > 8 ? vodUrlRaw.trim() : null;

  const endData: { isActive: false; endedAt: Date; vodUrl?: string } = {
    isActive: false,
    endedAt: new Date(),
  };

  if (endAll && creatorId) {
    const r = await prisma.workSession.updateMany({
      where: { creatorId: String(creatorId), isActive: true },
      data: endData,
    });
    return NextResponse.json({ ended: r.count });
  }

  if (sessionId) {
    const existing = await prisma.workSession.findUnique({ where: { id: String(sessionId) } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    if (existing.journeyNodeId) {
      await prisma.journeyNode
        .update({
          where: { id: existing.journeyNodeId },
          data: {
            sessionEndedAt: new Date(),
            ...(vodUrl ? { vodUrl } : {}),
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({ session: s });
  }

  if (roomId) {
    const active = await prisma.workSession.findMany({
      where: { roomId: String(roomId), isActive: true },
    });
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
