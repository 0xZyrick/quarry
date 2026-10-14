import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * GET /api/creators/[handle]
 * Network layer: creator journey profile — history of work as evolving stories,
 * not a static portfolio of outcomes.
 */
export async function GET(_req: NextRequest, { params }: { params: { handle: string } }) {
  const handle = decodeURIComponent(params.handle);
  const user = await prisma.user.findFirst({
    where: { handle },
    select: {
      id: true,
      handle: true,
      levelTrack: true,
      createdAt: true,
      projects: {
        orderBy: { updatedAt: "desc" },
        include: {
          journeyNodes: {
            orderBy: { position: "asc" },
            include: { mediaDrops: { take: 1, orderBy: { createdAt: "desc" } } },
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
      tag: n.mediaDrops[0]?.tag ?? null,
    })),
  }));

  return NextResponse.json({
    creator: { id: user.id, handle: user.handle, levelTrack: user.levelTrack, joinedAt: user.createdAt },
    journeys,
  });
}
