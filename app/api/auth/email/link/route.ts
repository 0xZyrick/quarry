import { PrismaClient } from "@prisma/client";
import { getIdentity } from "@/lib/identity";
import { emailAuthClient, hasEmailAuthConfig, normalizeEmail } from "@/lib/server/emailAuth";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const session = getIdentity(req).session;
  if (!session) return json({ error: "Sign in before adding an email." }, 401);
  if (!(await limit(`link-email:${ipOf(req)}`, 8, 60 * 60_000))) {
    return json({ error: "Too many codes requested. Try again later." }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!(await limit(`link-email-address:${email}`, 5, 60 * 60_000))) {
    return json({ error: "Too many codes requested for this email. Try again later." }, 429);
  }
  if (!hasEmailAuthConfig()) {
    return json({ error: "Email sign-in isn't configured. Set the Supabase Auth environment variables." }, 503);
  }

  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== session.uid) {
    return json({ error: "That email is already linked to another Wippo account." }, 409);
  }

  const user = await prisma.user.upsert({
    where: { id: session.uid },
    create: {
      id: session.uid,
      handle: session.handle,
      accountTrack: session.track,
    },
    update: {},
    select: { handle: true, accountTrack: true },
  });
  const handle = user.handle || session.handle;
  const existingPending = await prisma.pendingEmailAuth.findUnique({
    where: { handle },
    select: { email: true },
  });
  if (existingPending && existingPending.email !== email) {
    return json({ error: "An account setup is already using this handle. Try again later." }, 409);
  }

  await prisma.pendingEmailAuth.upsert({
    where: { email },
    create: {
      email,
      handle,
      accountTrack: user.accountTrack || session.track || "creator",
      linkUid: session.uid,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
    update: {
      handle,
      accountTrack: user.accountTrack || session.track || "creator",
      linkUid: session.uid,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });

  const { error } = await emailAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error("Could not send email-link OTP", error.message);
    return json({ error: "Could not send a verification code. Try again shortly." }, 502);
  }
  return json({ ok: true, message: "Check your email for a verification code." });
}
