import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { readSession } from "@/lib/server/session";
import { isMissingSchemaError, MISSING_COLLABORATION_SCHEMA } from "@/lib/server/prismaErrors";


function helpModel() {
  return (prisma as any).helpRequest;
}

export async function GET(req: NextRequest) {
  try {
    const model = helpModel();
    if (!model?.findMany) {
      return NextResponse.json(
        { error: MISSING_COLLABORATION_SCHEMA },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "OPEN";
    const projectId = searchParams.get("projectId");
    const take = Math.min(40, Math.max(1, Number(searchParams.get("take") || 24)));

    const rows = await model.findMany({
      where: {
        ...(status === "ACTIVE"
          ? { status: { in: ["OPEN", "IN_PROGRESS"] } }
          : status !== "ALL"
            ? { status }
            : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            creator: { select: { id: true, handle: true } },
          },
        },
      },
    });
    const claimerIds: string[] = [
      ...new Set<string>(
        rows
          .map((row: any) => row.claimedById)
          .filter((id: unknown): id is string => typeof id === "string")
      ),
    ];
    const claimers = claimerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: claimerIds } },
          select: { id: true, handle: true },
        })
      : [];
    const claimerById = new Map(claimers.map((user) => [user.id, user.handle]));

    return NextResponse.json({
      help: rows.map((h: any) => ({
        id: h.id,
        title: h.title,
        body: h.body,
        tags: h.tags || [],
        status: h.status,
        projectId: h.projectId,
        projectTitle: h.project?.title,
        handle: h.project?.creator?.handle || "anon",
        creatorId: h.creatorId,
        claimedById: h.claimedById,
        claimedByHandle: h.claimedById ? claimerById.get(h.claimedById) || null : null,
        claimedAt: h.claimedAt,
        nodeId: h.nodeId,
        createdAt: h.createdAt,
      })),
    });
  } catch (e) {
    console.error("GET /api/help", e);
    if (isMissingSchemaError(e)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load help requests." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to post a help request." }, { status: 401 });
  const model = helpModel();
  if (!model?.create) {
    return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const { projectId, title, body: text, tags, nodeId } = body;
  if (!projectId || !title?.trim()) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, creatorId: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.creatorId !== session.uid) return NextResponse.json({ error: "Only the project owner can post a help request." }, { status: 403 });
    const help = await model.create({
      data: {
        projectId,
        creatorId: session.uid,
        title: String(title).trim(),
        body: text ? String(text).trim() : null,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === "string").slice(0, 8) : [],
        nodeId: nodeId || null,
        status: "OPEN",
      },
    });
    return NextResponse.json({ help }, { status: 201 });
  } catch (error) {
    console.error("POST /api/help", error);
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not post the help request." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to offer help." }, { status: 401 });
  const model = helpModel();
  if (!model?.findUnique) {
    return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, status } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let existing;
  try {
    existing = await model.findUnique({
      where: { id: String(id) },
      include: { project: { select: { creatorId: true, title: true } } },
    });
  } catch (error) {
    console.error("PATCH /api/help lookup", error);
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load this help request." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.claim === true) {
    if (existing.creatorId === session.uid) return NextResponse.json({ error: "You cannot claim your own request." }, { status: 400 });
    if (existing.status !== "OPEN") {
      return NextResponse.json({ error: "Already claimed or closed" }, { status: 409 });
    }
    let claimed;
    try {
      claimed = await model.updateMany({
        where: { id: String(id), status: "OPEN" },
        data: { status: "IN_PROGRESS", claimedById: session.uid, claimedAt: new Date() },
      });
    } catch (error) {
      console.error("PATCH /api/help claim", error);
      if (isMissingSchemaError(error)) {
        return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
      }
      return NextResponse.json({ error: "Could not claim this help request." }, { status: 500 });
    }
    if (!claimed.count) return NextResponse.json({ error: "Already claimed or closed" }, { status: 409 });
    const help = await model.findUnique({ where: { id: String(id) } });
    if (!help) return NextResponse.json({ error: "Help request not found after claiming." }, { status: 404 });
    try {
      await prisma.notification.create({
        data: {
          userId: existing.project.creatorId,
          type: "help_claimed",
          title: "Someone offered help",
          body: `Your ask "${existing.title}" on ${existing.project.title} was claimed.`,
          href: `room:${existing.projectId}`,
          meta: JSON.stringify({ helpId: help.id, claimerId: session.uid }),
        },
      });
    } catch (error) {
      console.error("Could not notify project owner that help was claimed", error);
    }
    return NextResponse.json({
      help: {
        ...help,
        claimedByHandle: session.handle ? String(session.handle).replace(/^@/, "") : null,
      },
    });
  }

  if (!status) return NextResponse.json({ error: "id and status (or claim) required" }, { status: 400 });
  const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (existing.project.creatorId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const help = await model.update({
      where: { id: String(id) },
      data: {
        status,
        closedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        ...(status === "OPEN" ? { claimedById: null, claimedAt: null } : {}),
      },
    });
    return NextResponse.json({ help });
  } catch (error) {
    console.error("PATCH /api/help status", error);
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: MISSING_COLLABORATION_SCHEMA }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not update this help request." }, { status: 500 });
  }
}
