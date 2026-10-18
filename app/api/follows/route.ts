import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { readSession } from "@/lib/server/session";


/**
 * Project Circle follows.
 * GET  ?userId=   → list of projects this user follows
 * GET  ?projectId=&counts=1 → follower count for a project
 * POST { userId, projectId } → follow project
 * DELETE { userId, projectId } → unfollow
 * PATCH { userId, projectId } → mark seen
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const projectId = searchParams.get("projectId");
  const counts = searchParams.get("counts");

  // Counts only
  if (projectId && counts) {
    const followerCount = await prisma.projectFollow.count({ where: { projectId } });
    return NextResponse.json({ projectId, followerCount });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const session = readSession(req);
  if (!session || session.uid !== userId) return NextResponse.json({ error: "Sign in to view your follows." }, { status: 401 });

  const follows = await prisma.projectFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        include: {
          creator: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
          journeyNodes: {
            orderBy: { position: "desc" },
            take: 3,
            include: { mediaDrops: { take: 1, orderBy: { createdAt: "desc" } } },
          },
          _count: { select: { followers: true } },
        },
      },
    },
  });

  const items = follows.map((f) => {
    const nodes = f.project.journeyNodes ?? [];
    const latest = nodes[0] ?? null;
    const newNodes = nodes.filter((n) => n.createdAt > f.lastSeenAt);
    return {
      id: f.id,
      projectId: f.projectId,
      lastSeenAt: f.lastSeenAt,
      createdAt: f.createdAt,
      hasUpdates: newNodes.length > 0,
      project: {
        id: f.project.id,
        title: f.project.title,
        intent: f.project.intentStatement,
        status: f.project.status,
        visibility: (f.project as any).visibility,
        followerCount: f.project._count.followers,
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
              thumbUrl:
                (latest as any).nextSnapshotUrl ||
                (latest as any).prevSnapshotUrl ||
                null,
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

  return NextResponse.json({
    follows: items,
    count: items.length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId) {
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });
  }
  const session = readSession(req);
  if (!session || session.uid !== userId) return NextResponse.json({ error: "Sign in to follow this project." }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, creatorId: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });

  const follow = await prisma.projectFollow.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  });

  const followerCount = await prisma.projectFollow.count({ where: { projectId } });
  return NextResponse.json({ follow, followerCount }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId) {
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });
  }
  const session = readSession(req);
  if (!session || session.uid !== userId) return NextResponse.json({ error: "Sign in to update your follows." }, { status: 401 });
  await prisma.projectFollow.deleteMany({ where: { userId, projectId } });
  const followerCount = await prisma.projectFollow.count({ where: { projectId } });
  return NextResponse.json({ ok: true, followerCount });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, projectId } = body;
  if (!userId || !projectId) {
    return NextResponse.json({ error: "userId and projectId required" }, { status: 400 });
  }
  const session = readSession(req);
  if (!session || session.uid !== userId) return NextResponse.json({ error: "Sign in to update your follows." }, { status: 401 });
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
