import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { isMissingSchemaError, MISSING_COLLABORATION_SCHEMA } from "@/lib/server/prismaErrors";


/**
 * GET — Discover mosaic (hides empty projects) or creator list (includes empty).
 * POST — create project (title required; intent defaults to title).
 *
 * Replace: app/api/projects/route.ts
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "IN_PROGRESS";
    const creatorId = searchParams.get("creatorId");

    const projects = await prisma.project.findMany({
      where: {
        status: status as any,
        ...(creatorId ? { creatorId } : {}),
        // Discover only: skip projects with zero updates
        ...(!creatorId ? { journeyNodes: { some: {} } } : {}),
      },
      include: {
        creator: { select: { id: true, handle: true, levelTrack: true } },
        journeyNodes: {
          orderBy: { position: "desc" },
          take: 1,
          include: {
            mediaDrops: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    });

    const mosaic = projects.map((p) => {
      const nodes = p.journeyNodes ?? [];
      const latest = nodes.length ? nodes[0] : null;
      const drop = latest?.mediaDrops?.[0] as any;
      const hasVideo = !!(drop?.videoUrl);
      // Media may live on MediaDrop or directly on JourneyNode (image updates)
      const prev =
        drop?.prevSnapshotUrl || (latest as any)?.prevSnapshotUrl || null;
      const next =
        drop?.nextSnapshotUrl || (latest as any)?.nextSnapshotUrl || null;
      const mediaUrl = drop?.videoUrl || next || prev || p.coverImageUrl || null;

      return {
        id: p.id,
        title: p.title,
        intent: p.intentStatement,
        coverImageUrl: p.coverImageUrl,
        status: p.status,
        creator: {
          id: p.creator.id,
          handle: p.creator.handle || p.creator.id?.slice(0, 8) || "anon",
          levelTrack: (p.creator as any).levelTrack,
        },
        latestNode: latest
          ? {
              dayLabel: latest.dayLabel,
              phaseTitle: latest.phaseTitle,
              summary: latest.summaryText,
              evolutionDelta: (latest as any).evolutionDelta ?? null,
              mediaUrl,
              thumbUrl: next || prev || null,
              prevUrl: prev,
              nextUrl: next,
              hasVideo,
              durationSecs: drop?.durationSecs ?? null,
              decisionMetric: drop?.decisionMetric ?? null,
              tag: drop?.tag ?? null,
            }
          : null,
        nodeCount: nodes.length,
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json({ projects: mosaic });
  } catch (e) {
    console.error("GET /api/projects", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load projects." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, handle, title, intentStatement, status, visibility, currentState, displayName, zoneId, coverImageUrl } =
      body;

    if (!creatorId || typeof creatorId !== "string") {
      return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || title.trim().length < 2) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const intent =
      typeof intentStatement === "string" && intentStatement.trim().length >= 3
        ? intentStatement.trim()
        : title.trim();

    const cleanHandle =
      typeof handle === "string" && handle.trim()
        ? handle
            .trim()
            .replace(/^@/, "")
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "")
            .slice(0, 32)
        : null;

    const visMap: Record<string, string> = {
      public: "PUBLIC",
      PUBLIC: "PUBLIC",
      circle: "CIRCLE",
      CIRCLE: "CIRCLE",
      private: "PRIVATE",
      PRIVATE: "PRIVATE",
    };
    const vis = visMap[String(visibility || "PUBLIC")] || "PUBLIC";

    let st: "IN_PROGRESS" | "COMPLETED" | "PAUSED" = "IN_PROGRESS";
    if (status === "COMPLETED" || status === "completed") st = "COMPLETED";
    if (status === "PAUSED" || status === "paused") st = "PAUSED";

    try {
      await prisma.user.upsert({
        where: { id: creatorId },
        create: {
          id: creatorId,
          ...(cleanHandle ? { handle: cleanHandle } : {}),
          ...(typeof displayName === "string" && displayName.trim()
            ? { displayName: displayName.trim().slice(0, 48) }
            : {}),
        },
        update: {
          ...(cleanHandle ? { handle: cleanHandle } : {}),
          ...(typeof displayName === "string" && displayName.trim()
            ? { displayName: displayName.trim().slice(0, 48) }
            : {}),
        },
      });
    } catch (err) {
      console.warn("user upsert skipped", err);
    }

    const project = await prisma.project.create({
      data: {
        creatorId,
        title: title.trim(),
        intentStatement: intent,
        ...(typeof coverImageUrl === "string" && coverImageUrl.startsWith("http")
          ? { coverImageUrl: coverImageUrl.slice(0, 2048) }
          : {}),
        status: st as any,
        visibility: vis as any,
        ...(typeof currentState === "string" && currentState.trim()
          ? { currentState: currentState.trim().slice(0, 280) }
          : {}),
        ...(typeof zoneId === "string" && zoneId.trim()
          ? { zoneId: zoneId.trim().slice(0, 32) }
          : {}),
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/projects", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
