import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * POST /api/follows — follow a project (Curiosity → Return loop)
 * DELETE /api/follows — unfollow
 * PATCH /api/follows — mark lastSeenAt (visitor returned; clear "new since last visit")
 * GET /api/follows?userId= — list followed projects with change deltas
 */
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const follows = await prisma.projectFollow.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          creator: { select: { id: true, handle: true, levelTrack: true } },
          journeyNodes: {
            orderBy: { position: "desc" },
            take: 5,
            include: { mediaDrops: { take: 1, orderBy: { createdAt: "desc" } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = follows.map((f) => {
    const newNodes = f.project.journeyNodes.filter(
      (n) => n.createdAt > f.lastSeenAt
    );
    const latest = f.project.journeyNodes[0] ?? null;
    return {
      followId: f.id,
      projectId: f.projectId,
      lastSeenAt: f.lastSeenAt,
      followedAt: f.createdAt,
      hasUpdates: newNodes.length > 0,
      newNodeCount: newNodes.length,
      project: {
        id: f.project.id,
        title: f.project.title,
        intent: f.project.intentStatement,
        status: f.project.status,
        creator: f.project.creator,
        updatedAt: f.project.updatedAt,
        latestNode: latest
          ? {
              dayLabel: latest.dayLabel,
              phaseTitle: latest.phaseTitle,
              summary: latest.summaryText,
              evolutionDelta: latest.evolutionDelta,
              createdAt: latest.createdAt,
              mediaUrl: latest.mediaDrops[0]?.videoUrl ?? null,
            }
          : null,
        newPhases: newNodes.map((n) => ({
          dayLabel: n.dayLabel,
          phaseTitle: n.phaseTitle,
          summary: n.summaryText,
        })),
      },
    };
  });

  return NextResponse.json({ follows: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId)
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });

  const follow = await prisma.projectFollow.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  });
  return NextResponse.json({ follow }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId)
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });
  await prisma.projectFollow.deleteMany({ where: { userId, projectId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  // Mark as seen — clears "hasUpdates" for the Return loop
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId)
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });
  try {
    const follow = await prisma.projectFollow.update({
      where: { userId_projectId: { userId, projectId } },
      data: { lastSeenAt: new Date() },
    });
    return NextResponse.json({ follow });
  } catch {
    return NextResponse.json({ error: "Not following" }, { status: 404 });
  }
}
