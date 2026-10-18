import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { readSession } from "@/lib/server/session";


/**
 * GET  ?userId=           → conversations for user
 * GET  ?conversationId=   → messages in thread
 * POST { userId, toUserId, body } → send (creates conversation if needed)
 * POST { userId, conversationId, body } → reply
 */
export async function GET(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to view messages." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const conversationId = searchParams.get("conversationId");

  if (conversationId) {
    const membership = await prisma.conversationMember.findFirst({
      where: { conversationId, userId: session.uid },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    // resolve handles
    const ids = [...new Set(messages.map((m) => m.senderId))];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, handle: true, displayName: true, avatarUrl: true },
    });
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        sender: byId[m.senderId] || { id: m.senderId, handle: null },
      })),
    });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId or conversationId required" }, { status: 400 });
  }
  if (userId !== session.uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const otherIds = memberships.flatMap((m) =>
    m.conversation.members.filter((x) => x.userId !== userId).map((x) => x.userId)
  );
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(otherIds)] } },
    select: { id: true, handle: true, displayName: true, avatarUrl: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  const conversations = memberships.map((m) => {
    const others = m.conversation.members
      .filter((x) => x.userId !== userId)
      .map((x) => byId[x.userId] || { id: x.userId, handle: null });
    const last = m.conversation.messages[0] || null;
    return {
      id: m.conversation.id,
      updatedAt: m.conversation.updatedAt,
      others,
      lastMessage: last,
      unread: last ? last.createdAt > m.lastReadAt && last.senderId !== userId : false,
    };
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, toUserId, conversationId, body: text } = body;
  const msg = typeof text === "string" ? text.trim() : "";
  if (!userId || userId !== session.uid || msg.length < 1) {
    return NextResponse.json({ error: "userId and body required" }, { status: 400 });
  }
  const senderId = session.uid;

  await prisma.user.upsert({ where: { id: senderId }, create: { id: senderId }, update: {} });

  let convId = conversationId as string | undefined;

  if (!convId && toUserId) {
    if (toUserId === senderId) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }
    await prisma.user.upsert({ where: { id: toUserId }, create: { id: toUserId }, update: {} });

    // Find existing 1:1
    const mine = await prisma.conversationMember.findMany({
      where: { userId: senderId },
      include: { conversation: { include: { members: true } } },
    });
    const existing = mine.find(
      (m) =>
        m.conversation.members.length === 2 &&
        m.conversation.members.some((x) => x.userId === toUserId)
    );
    if (existing) {
      convId = existing.conversationId;
    } else {
      const conv = await prisma.conversation.create({
        data: {
          members: {
            create: [{ userId: senderId }, { userId: toUserId }],
          },
        },
      });
      convId = conv.id;
    }
  }

  if (!convId) {
    return NextResponse.json({ error: "conversationId or toUserId required" }, { status: 400 });
  }
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId: convId, userId: senderId },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const message = await prisma.message.create({
    data: { conversationId: convId, senderId, body: msg.slice(0, 2000) },
  });
  await prisma.conversation.update({
    where: { id: convId },
    data: { updatedAt: new Date() },
  });

  // Notify recipient(s)
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: convId },
  });
  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, displayName: true },
  });
  const label = sender?.displayName || sender?.handle || "Someone";
  for (const m of members) {
    if (m.userId === senderId) continue;
    await prisma.notification.create({
      data: {
        userId: m.userId,
        type: "message",
        title: `Message from ${label}`,
        body: msg.slice(0, 120),
        href: `message:${convId}`,
      },
    });
  }

  return NextResponse.json({ message, conversationId: convId }, { status: 201 });
}

/** Mark conversation read */
export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to update messages." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, conversationId } = body;
  if (!userId || userId !== session.uid || !conversationId) {
    return NextResponse.json({ error: "userId and conversationId required" }, { status: 400 });
  }
  const updated = await prisma.conversationMember.updateMany({
    where: { userId: session.uid, conversationId },
    data: { lastReadAt: new Date() },
  });
  if (!updated.count) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
