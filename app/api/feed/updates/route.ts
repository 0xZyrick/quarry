import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";


/**
 * GET /api/feed/updates
 * Aggregation of journey updates (builds) across public projects.
 * One card = one JourneyNode, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const take = Math.min(48, Math.max(1, Number(searchParams.get("take") || 24)));
    const cursor = searchParams.get("cursor");

    const nodes = await prisma.journeyNode.findMany({
      where: {
        project: {
          visibility: "PUBLIC",
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        project: {
          select: {
            id: true,
            title: true,
            intentStatement: true,
            status: true,
            creator: { select: { id: true, handle: true, displayName: true } },
          },
        },
        mediaDrops: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const items = nodes.map((n) => {
      const drop = n.mediaDrops[0];
      const live = !!(n.liveUrl && !n.sessionEndedAt);
      const replay = n.vodUrl || drop?.videoUrl || null;
      const thumb =
        n.nextSnapshotUrl ||
        n.prevSnapshotUrl ||
        (n.imageUrls && n.imageUrls[0]) ||
        null;

      return {
        id: n.id,
        projectId: n.projectId,
        projectTitle: n.project.title,
        intent: n.project.intentStatement,
        handle: n.project.creator.handle || n.project.creator.id.slice(0, 8),
        creatorId: n.project.creator.id,
        phaseTitle: n.phaseTitle,
        updateTitle: n.updateTitle,
        dayLabel: n.dayLabel,
        summary: n.summaryText,
        evolutionDelta: n.evolutionDelta,
        live,
        liveUrl: n.liveUrl,
        vodUrl: n.vodUrl,
        mediaUrl: replay,
        thumbUrl: thumb,
        imageUrls: n.imageUrls || [],
        hasVideo: !!(replay || n.liveUrl),
        position: n.position,
        createdAt: n.createdAt,
        sessionStartedAt: n.sessionStartedAt,
        sessionEndedAt: n.sessionEndedAt,
      };
    });

    return NextResponse.json({
      updates: items,
      nextCursor: items.length ? items[items.length - 1].id : null,
    });
  } catch (e) {
    console.error("GET /api/feed/updates", e);
    return NextResponse.json({ updates: [], nextCursor: null });
  }
}
