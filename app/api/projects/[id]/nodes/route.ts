import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { dayLabel, phaseTitle, summaryText, evolutionDelta, prevSnapshotUrl, nextSnapshotUrl, media } = body;
  if (!dayLabel || !phaseTitle || !summaryText)
    return NextResponse.json({ error: "dayLabel, phaseTitle, summaryText required" }, { status: 400 });
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, journeyNodes: { select: { position: true }, orderBy: { position: "desc" }, take: 1 } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const nextPos = (project.journeyNodes[0]?.position ?? 0) + 1;
  if (media) {
    if (!media.videoUrl || typeof media.durationSecs !== "number")
      return NextResponse.json({ error: "media.videoUrl and durationSecs required" }, { status: 400 });
    if (media.type === "PERMANENT_TEASE" && media.durationSecs > 90)
      return NextResponse.json({ error: "PERMANENT_TEASE ≤ 90s" }, { status: 400 });
    if (!media.decisionMetric)
      return NextResponse.json({ error: "decisionMetric required (trade-off / experiment / refactor)" }, { status: 400 });
  }
  const node = await prisma.journeyNode.create({
    data: {
      projectId: params.id, position: nextPos,
      dayLabel: String(dayLabel).trim(), phaseTitle: String(phaseTitle).trim(), summaryText: String(summaryText).trim(),
      evolutionDelta: evolutionDelta ? String(evolutionDelta).trim() : null,
      prevSnapshotUrl: prevSnapshotUrl ?? null, nextSnapshotUrl: nextSnapshotUrl ?? null,
      ...(media ? { mediaDrops: { create: {
        type: media.type === "STREAM_VOD_7DAY" ? "STREAM_VOD_7DAY" : "PERMANENT_TEASE",
        videoUrl: media.videoUrl, durationSecs: media.durationSecs,
        decisionMetric: media.decisionMetric, tag: media.tag ?? null, isLiveExtract: !!media.isLiveExtract,
      }}} : {}),
    },
    include: { mediaDrops: true },
  });
  await prisma.project.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ node }, { status: 201 });
}
