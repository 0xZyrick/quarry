import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** GET — Mosaic items with Intent hooks. POST — create project (Intent required). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "IN_PROGRESS";
  const creatorId = searchParams.get("creatorId");
  const projects = await prisma.project.findMany({
    where: { status: status as any, ...(creatorId ? { creatorId } : {}) },
    include: {
      creator: { select: { id: true, handle: true, levelTrack: true } },
      journeyNodes: {
        orderBy: { position: "asc" },
        take: 3,
        include: { mediaDrops: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 48,
  });
  const mosaic = projects.map((p) => {
    const latest = p.journeyNodes[p.journeyNodes.length - 1];
    const drop = latest?.mediaDrops[0];
    return {
      id: p.id, title: p.title, intent: p.intentStatement, status: p.status, creator: p.creator,
      latestNode: latest ? {
        dayLabel: latest.dayLabel, phaseTitle: latest.phaseTitle, summary: latest.summaryText,
        evolutionDelta: latest.evolutionDelta, mediaUrl: drop?.videoUrl ?? null,
        decisionMetric: drop?.decisionMetric ?? null, tag: drop?.tag ?? null,
      } : null,
      nodeCount: p.journeyNodes.length, updatedAt: p.updatedAt,
    };
  });
  return NextResponse.json({ projects: mosaic });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { creatorId, title, intentStatement, currentState, nextStep } = body;
  if (!creatorId || typeof creatorId !== "string")
    return NextResponse.json({ error: "creatorId required" }, { status: 400 });
  if (!title || typeof title !== "string" || title.trim().length < 3)
    return NextResponse.json({ error: "title required (min 3 chars)" }, { status: 400 });
  if (!intentStatement || typeof intentStatement !== "string" || intentStatement.trim().length < 10)
    return NextResponse.json({ error: "intentStatement required (min 10 chars). What problem are you solving right now?" }, { status: 400 });
  await prisma.user.upsert({ where: { id: creatorId }, create: { id: creatorId }, update: {} });
  const project = await prisma.project.create({
    data: { creatorId, title: title.trim(), intentStatement: intentStatement.trim() },
  });
  return NextResponse.json({ project }, { status: 201 });
}
