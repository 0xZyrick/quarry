import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
const VALID = new Set(["SUGGESTION", "CRITIQUE", "ENCOURAGEMENT"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { journeyNodeId, userId, type, messageText } = body;
  if (!journeyNodeId || !userId || !type || !messageText)
    return NextResponse.json({ error: "journeyNodeId, userId, type, messageText required" }, { status: 400 });
  if (!VALID.has(type)) return NextResponse.json({ error: "type must be SUGGESTION|CRITIQUE|ENCOURAGEMENT" }, { status: 400 });
  if (typeof messageText !== "string" || messageText.trim().length < 3)
    return NextResponse.json({ error: "messageText too short" }, { status: 400 });
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  const node = await prisma.journeyNode.findUnique({ where: { id: journeyNodeId }, select: { id: true } });
  if (!node) return NextResponse.json({ error: "JourneyNode not found" }, { status: 404 });
  const contribution = await prisma.contribution.create({
    data: { journeyNodeId, userId, type, messageText: messageText.trim() },
    include: { user: { select: { id: true, handle: true } } },
  });
  return NextResponse.json({ contribution }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, isPinnedByHost, hostUserId } = body;
  if (typeof body.markedHelpful === "boolean" && id) {
    const contrib = await prisma.contribution.findUnique({
      where: { id: String(id) },
      include: { journeyNode: { include: { project: { select: { creatorId: true } } } } },
    });
    if (!contrib) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (hostUserId && contrib.journeyNode.project.creatorId !== hostUserId) {
      return NextResponse.json({ error: "Only host can mark helpful" }, { status: 403 });
    }
    const updated = await prisma.contribution.update({
      where: { id: String(id) },
      data: {
        markedHelpful: body.markedHelpful,
        markedHelpfulAt: body.markedHelpful ? new Date() : null,
      },
      include: { user: { select: { id: true, handle: true } } },
    });
    return NextResponse.json({ contribution: updated });
  }

  if (!id || typeof isPinnedByHost !== "boolean")
    return NextResponse.json({ error: "id and isPinnedByHost required" }, { status: 400 });
  const contrib = await prisma.contribution.findUnique({
    where: { id },
    include: { journeyNode: { include: { project: { select: { creatorId: true } } } } },
  });
  if (!contrib) return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  if (hostUserId && contrib.journeyNode.project.creatorId !== hostUserId)
    return NextResponse.json({ error: "Only project host can pin" }, { status: 403 });
  const updated = await prisma.contribution.update({ where: { id }, data: { isPinnedByHost } });
  return NextResponse.json({ contribution: updated });
}
