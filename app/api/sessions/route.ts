import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/** Work Session — live / recorded / progress-update. Public only in discovery. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const active = searchParams.get("active");

  const sessions = await prisma.workSession.findMany({
    where: {
      visibility: "PUBLIC", // never leak private into list endpoints
      ...(projectId ? { projectId } : {}),
      ...(active === "1" ? { isActive: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    creatorId,
    projectId,
    title,
    goal,
    currentState,
    nextStep,
    visibility,
    mode,
    roomId,
  } = body;

  if (!creatorId || !title)
    return NextResponse.json({ error: "creatorId and title required" }, { status: 400 });

  const session = await prisma.workSession.create({
    data: {
      creatorId,
      projectId: projectId || null,
      title: String(title).trim(),
      goal: goal ? String(goal).trim() : null,
      currentState: currentState ? String(currentState).trim() : null,
      nextStep: nextStep ? String(nextStep).trim() : null,
      visibility: visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      mode: mode === "RECORDED" ? "RECORDED" : mode === "PROGRESS_UPDATE" ? "PROGRESS_UPDATE" : "LIVE",
      roomId: roomId || null,
      isActive: true,
    },
  });
  return NextResponse.json({ session }, { status: 201 });
}
