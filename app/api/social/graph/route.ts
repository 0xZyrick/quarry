import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";


/**
 * Lightweight social activity graph for the map / community layer.
 * Each node = a room or active session with a card of what's happening.
 *
 * GET ?limit=40
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(
    60,
    Math.max(1, Number(new URL(req.url).searchParams.get("limit") || 40))
  );

  const [sessions, recentProjects] = await Promise.all([
    prisma.workSession.findMany({
      where: { isActive: true, visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            intentStatement: true,
            creator: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
            zoneId: true,
            _count: { select: { followers: true } },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: { visibility: "PUBLIC", status: "IN_PROGRESS" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        creator: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
        _count: { select: { followers: true, journeyNodes: true } },
        journeyNodes: {
          orderBy: { position: "desc" },
          take: 1,
          select: {
            summaryText: true,
            phaseTitle: true,
            nextSnapshotUrl: true,
            prevSnapshotUrl: true,
            createdAt: true,
            mediaDrops: { take: 1, select: { videoUrl: true } },
          },
        },
      },
    }),
  ]);

  const nodes = [
    ...sessions.map((s) => ({
      id: `session:${s.id}`,
      kind: "session" as const,
      roomId: s.roomId || s.id,
      title: s.title,
      goal: s.goal || s.currentState,
      mode: s.mode,
      isLive: s.mode === "LIVE" && s.isActive,
      projectId: s.projectId,
      projectTitle: s.project?.title ?? null,
      creator: s.project?.creator ?? { id: s.creatorId, handle: null },
      followerCount: s.project?._count.followers ?? 0,
      updatedAt: s.createdAt,
      card: {
        headline: s.title,
        sub: s.currentState || s.goal || s.nextStep || "Working live",
        media: null as string | null,
      },
    })),
    ...recentProjects.map((p) => {
      const n = p.journeyNodes[0];
      return {
        id: `project:${p.id}`,
        kind: "project" as const,
        roomId: null as string | null,
        title: p.title,
        goal: p.intentStatement,
        mode: "PROGRESS_UPDATE",
        isLive: false,
        projectId: p.id,
        projectTitle: p.title,
        zoneId: (p as any).zoneId || null,
        creator: p.creator,
        followerCount: p._count.followers,
        updatedAt: p.updatedAt,
        card: {
          headline: n?.phaseTitle || n?.summaryText || p.title,
          sub: n?.summaryText || p.intentStatement,
          media:
            n?.nextSnapshotUrl ||
            n?.prevSnapshotUrl ||
            n?.mediaDrops[0]?.videoUrl ||
            null,
        },
      };
    }),
  ]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, limit);

  return NextResponse.json({
    nodes,
    generatedAt: new Date().toISOString(),
  });
}
