import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";


/**
 * Person-to-person follow graph.
 * GET  ?viewerId=  → { following: boolean, followerCount, followingCount }
 * POST { viewerId } → follow this handle
 * DELETE { viewerId } → unfollow
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  const viewerId = new URL(req.url).searchParams.get("viewerId");

  const user = await prisma.user.findFirst({
    where: { handle },
    select: {
      id: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let following = false;
  if (viewerId) {
    const edge = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: user.id },
      },
    });
    following = !!edge;
  }

  return NextResponse.json({
    userId: user.id,
    handle,
    following,
    followerCount: user._count.followers,
    followingCount: user._count.following,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  const body = await req.json().catch(() => ({}));
  const viewerId = body.viewerId as string;
  if (!viewerId) return NextResponse.json({ error: "viewerId required" }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { handle }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === viewerId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await prisma.user.upsert({ where: { id: viewerId }, create: { id: viewerId }, update: {} });

  await prisma.userFollow.upsert({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: target.id },
    },
    create: { followerId: viewerId, followingId: target.id },
    update: {},
  });

  const followerCount = await prisma.userFollow.count({ where: { followingId: target.id } });
  return NextResponse.json({ ok: true, following: true, followerCount }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  const body = await req.json().catch(() => ({}));
  const viewerId = body.viewerId as string;
  if (!viewerId) return NextResponse.json({ error: "viewerId required" }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { handle }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.userFollow.deleteMany({
    where: { followerId: viewerId, followingId: target.id },
  });

  const followerCount = await prisma.userFollow.count({ where: { followingId: target.id } });
  return NextResponse.json({ ok: true, following: false, followerCount });
}
