import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { readSession } from "@/lib/server/session";


/**
 * GET  ?userId=           → notifications + derived circle updates
 * POST { userId, type, title, body?, href? } → create (system)
 * PATCH { userId, ids?: string[], all?: true } → mark read
 */
export async function GET(req: NextRequest) {
  const session = readSession(req);
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!session || session.uid !== userId) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });

  const [rows, follows] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.projectFollow.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            creator: { select: { handle: true } },
            journeyNodes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                summaryText: true,
                phaseTitle: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Derive circle update notifications (not yet stored)
  const derived = follows
    .filter((f) => {
      const n = f.project.journeyNodes[0];
      return n && n.createdAt > f.lastSeenAt;
    })
    .map((f) => {
      const n = f.project.journeyNodes[0]!;
      return {
        id: `circle-${f.projectId}`,
        userId,
        type: "circle_update",
        title: f.project.title,
        body: n.phaseTitle || n.summaryText,
        href: `project:${f.projectId}`,
        read: false,
        createdAt: n.createdAt,
        derived: true,
        meta: JSON.stringify({
          handle: f.project.creator?.handle,
          projectId: f.projectId,
        }),
      };
    });

  const items = [...derived, ...rows]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 50);

  const unread = items.filter((i) => !i.read).length;

  return NextResponse.json({ notifications: items, unread });
}

export async function POST(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to create notifications." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, type, title, body: text, href } = body;
  if (!userId || userId !== session.uid || !type || !title) {
    return NextResponse.json({ error: "userId, type, title required" }, { status: 400 });
  }
  const n = await prisma.notification.create({
    data: {
      userId,
      type: String(type).slice(0, 40),
      title: String(title).slice(0, 120),
      body: text ? String(text).slice(0, 280) : null,
      href: href ? String(href).slice(0, 200) : null,
    },
  });
  return NextResponse.json({ notification: n }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, ids, all } = body;
  if (!userId || userId !== session.uid) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (all) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    // Mark circle follows as seen
    await prisma.projectFollow.updateMany({
      where: { userId },
      data: { lastSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(ids) && ids.length) {
    const realIds = ids.filter((id: string) => !String(id).startsWith("circle-"));
    if (realIds.length) {
      await prisma.notification.updateMany({
        where: { userId, id: { in: realIds } },
        data: { read: true },
      });
    }
    // derived circle ids → mark follow seen
    for (const id of ids) {
      if (String(id).startsWith("circle-")) {
        const projectId = String(id).replace("circle-", "");
        await prisma.projectFollow.updateMany({
          where: { userId, projectId },
          data: { lastSeenAt: new Date() },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
