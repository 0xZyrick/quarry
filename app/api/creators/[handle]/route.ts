import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";


export async function GET(
  _req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  const user = await prisma.user.findFirst({
    where: { handle },
    select: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      levelTrack: true,
      createdAt: true,
      _count: {
        select: {
          projects: true,
          followers: true,
          following: true,
          projectFollows: true,
        },
      },
      projects: {
        where: { visibility: "PUBLIC" },
        orderBy: { updatedAt: "desc" },
        include: {
          journeyNodes: {
            orderBy: { position: "asc" },
            include: {
              mediaDrops: { take: 1, orderBy: { createdAt: "desc" } },
            },
          },
          _count: { select: { followers: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const journeys = user.projects.map((p) => ({
    id: p.id,
    title: p.title,
    intent: p.intentStatement,
    status: p.status,
    followerCount: p._count.followers,
    updatedAt: p.updatedAt,
    phases: p.journeyNodes.map((n) => ({
      dayLabel: n.dayLabel,
      phaseTitle: n.phaseTitle,
      summary: n.summaryText,
      evolutionDelta: n.evolutionDelta,
      mediaUrl: n.mediaDrops[0]?.videoUrl ?? null,
      thumbUrl: n.nextSnapshotUrl || n.prevSnapshotUrl || null,
      tag: n.mediaDrops[0]?.tag ?? null,
    })),
  }));

  return NextResponse.json({
    creator: {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName || user.handle,
      bio: user.bio || "",
      avatarUrl: user.avatarUrl,
      levelTrack: user.levelTrack,
      joinedAt: user.createdAt,
      counts: {
        projects: user._count.projects,
        followers: user._count.followers,
        following: user._count.following,
        circles: user._count.projectFollows,
      },
    },
    journeys,
  });
}
