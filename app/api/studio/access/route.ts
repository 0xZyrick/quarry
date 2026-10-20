import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { getIdentity } from "@/lib/identity";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getIdentity(req).session;
  if (!session) return json({ unlocked: false }, 200);
  const account = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { studioUnlocked: true },
  });
  return json({ unlocked: account?.studioUnlocked ?? false });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const session = getIdentity(req).session;
  if (!session) return json({ error: "Sign in to unlock Studio." }, 401);
  if (session.track !== "creator") {
    return json({ error: "Studio access is for builder accounts." }, 403);
  }
  if (!(await limit(`studio-code:${session.uid}:${ipOf(req)}`, 12, 60_000))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const invite = process.env.STUDIO_INVITE_CODE;
  if (!invite) return json({ error: "Studio access codes are not configured." }, 503);
  if (!code || code !== invite) return json({ error: "That creator code isn't valid." }, 403);

  await prisma.user.upsert({
    where: { id: session.uid },
    create: {
      id: session.uid,
      handle: session.handle,
      accountTrack: session.track,
      studioUnlocked: true,
    },
    update: { studioUnlocked: true },
  });
  return json({ unlocked: true });
}
