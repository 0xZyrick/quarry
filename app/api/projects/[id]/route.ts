import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, handle: true, levelTrack: true } },
      journeyNodes: {
        orderBy: { position: "asc" },
        include: {
          mediaDrops: { orderBy: { createdAt: "asc" } },
          discussions: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, handle: true } } } },
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim().length >= 3) data.title = body.title.trim();
  if (typeof body.intentStatement === "string") {
    if (body.intentStatement.trim().length < 10)
      return NextResponse.json({ error: "intentStatement min 10 chars" }, { status: 400 });
    data.intentStatement = body.intentStatement.trim();
  }
  if (body.status === "IN_PROGRESS" || body.status === "COMPLETED") data.status = body.status;
  if (!Object.keys(data).length) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  try {
    const project = await prisma.project.update({ where: { id: params.id }, data });
    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
}
