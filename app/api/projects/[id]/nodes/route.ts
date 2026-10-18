import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { validateDrop } from "@/lib/guardrails";
import { detectPlatform, parseStreamUrl } from "@/lib/streamEmbed";


const MAX_IMAGES = 3;

/**
 * POST — add a journey update (build node) on a project.
 * Evidence: liveUrl and/or images and/or short video. summaryText required.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const {
    dayLabel,
    phaseTitle,
    summaryText,
    evolutionDelta,
    prevSnapshotUrl,
    nextSnapshotUrl,
    media,
    liveUrl: liveUrlRaw,
    imageUrls: imageUrlsRaw,
    startSession,
    updateKind,
    promptUsed,
    tools: toolsRaw,
    tried: triedRaw,
  } = body;

  if (!summaryText || typeof summaryText !== "string" || summaryText.trim().length < 3) {
    return NextResponse.json(
      { error: "Context required (summaryText) — what are you building in this update?" },
      { status: 400 }
    );
  }

  const guard = validateDrop({
    currentState: summaryText,
    domain: body.domain,
    acknowledgedPolicy: body.acknowledgedPolicy === true,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 400 });
  }

  const liveUrl =
    typeof liveUrlRaw === "string" && liveUrlRaw.trim().length > 8 ? liveUrlRaw.trim() : null;
  if (liveUrl && !/^https?:\/\//i.test(liveUrl)) {
    return NextResponse.json({ error: "liveUrl must be an http(s) Twitch or YouTube link" }, { status: 400 });
  }

  let imageUrls: string[] = [];
  if (Array.isArray(imageUrlsRaw)) {
    imageUrls = imageUrlsRaw
      .filter((u: unknown) => typeof u === "string" && String(u).startsWith("http"))
      .slice(0, MAX_IMAGES) as string[];
  }

  const hasPair =
    typeof prevSnapshotUrl === "string" &&
    prevSnapshotUrl.length > 0 &&
    typeof nextSnapshotUrl === "string" &&
    nextSnapshotUrl.length > 0;
  const hasShort =
    media &&
    typeof media.videoUrl === "string" &&
    media.videoUrl.length > 0 &&
    typeof media.durationSecs === "number";
  const hasImages = imageUrls.length > 0 || hasPair;
  const hasLive = !!liveUrl;

  if (!hasPair && !hasShort && !hasImages && !hasLive) {
    return NextResponse.json(
      { error: "Add at least one of: liveUrl (Twitch/YouTube), images, or a short video (≤90s)" },
      { status: 400 }
    );
  }

  if (hasShort && media.durationSecs > 90) {
    return NextResponse.json({ error: "Shorts must be ≤ 90 seconds" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      journeyNodes: { select: { position: true }, orderBy: { position: "desc" }, take: 1 },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const nextPos = (project.journeyNodes[0]?.position ?? 0) + 1;
  const label =
    (dayLabel && String(dayLabel).trim()) || `UPDATE ${String(nextPos).padStart(2, "0")}`;
  const phase =
    (phaseTitle && String(phaseTitle).trim()) ||
    (hasLive ? "LIVE" : hasShort ? "SHORT" : "PROGRESS");

  const livePlatform = liveUrl ? detectPlatform(liveUrl) : null;
  const goLive = hasLive && startSession !== false;

  const node = await prisma.journeyNode.create({
    data: {
      projectId: params.id,
      position: nextPos,
      dayLabel: label,
      phaseTitle: phase,
      summaryText: summaryText.trim(),
      evolutionDelta: evolutionDelta ? String(evolutionDelta).trim() : `domain:${guard.domain}`,
      prevSnapshotUrl: hasPair ? prevSnapshotUrl : imageUrls[0] || null,
      nextSnapshotUrl: hasPair ? nextSnapshotUrl : imageUrls[1] || media?.thumbnailUrl || null,
      imageUrls,
      liveUrl: liveUrl,
      livePlatform: livePlatform,
      sessionStartedAt: goLive ? new Date() : null,
      updateKind:
        updateKind === "DEAD_END" || updateKind === "DECISION" || updateKind === "PARTIAL"
          ? updateKind
          : "MILESTONE",
      promptUsed: typeof promptUsed === "string" && promptUsed.trim() ? promptUsed.trim() : null,
      tools: Array.isArray(toolsRaw)
        ? toolsRaw.filter((x: unknown) => typeof x === "string").slice(0, 12)
        : [],
      ...(Array.isArray(triedRaw) && triedRaw.length
        ? {
            triedAttempts: {
              create: triedRaw
                .filter((row: any) => row && typeof row.detail === "string" && row.detail.trim())
                .slice(0, 12)
                .map((row: any, i: number) => ({
                  outcome:
                    row.outcome === "DEAD_END" ||
                    row.outcome === "PARTIAL" ||
                    row.outcome === "ARTIFACT"
                      ? row.outcome
                      : "WORKED",
                  detail: String(row.detail).trim(),
                  sortOrder: i,
                })),
            },
          }
        : {}),
      ...(hasShort
        ? {
            mediaDrops: {
              create: {
                type: "PERMANENT_TEASE",
                videoUrl: media.videoUrl,
                durationSecs: media.durationSecs,
                decisionMetric: media.decisionMetric || summaryText.trim().slice(0, 120),
                tag: media.tag ?? guard.domain,
                isLiveExtract: false,
              },
            },
          }
        : {}),
    },
    include: { mediaDrops: true, triedAttempts: true },
  });

  await prisma.project.update({
    where: { id: params.id },
    data: {
      updatedAt: new Date(),
      ...(typeof body.currentState === "string" && body.currentState.trim()
        ? { currentState: body.currentState.trim() }
        : { currentState: summaryText.trim() }),
    },
  });

  return NextResponse.json({ node }, { status: 201 });
}

/** PATCH — end live on a node; optional vodUrl */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { nodeId, vodUrl, endSession } = body;
  if (!nodeId || typeof nodeId !== "string") {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }

  const node = await prisma.journeyNode.findFirst({
    where: { id: nodeId, projectId: params.id },
  });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (endSession) data.sessionEndedAt = new Date();
  if (typeof vodUrl === "string" && vodUrl.trim().length > 8) data.vodUrl = vodUrl.trim();
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.journeyNode.update({ where: { id: nodeId }, data });

  if (endSession) {
    await prisma.workSession.updateMany({
      where: {
        projectId: params.id,
        isActive: true,
      },
      data: {
        isActive: false,
        endedAt: new Date(),
        ...(typeof vodUrl === "string" ? { vodUrl: vodUrl.trim() } : {}),
      },
    });
  }

  return NextResponse.json({ node: updated });
}
