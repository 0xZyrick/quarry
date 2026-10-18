import { prisma } from "@/lib/server/db";
import { emailAuthClient, hasEmailAuthConfig, normalizeEmail } from "@/lib/server/emailAuth";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";
import { validInvite, cleanName } from "@/lib/server/invite";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = ipOf(req);
  if (!limit(`invite:${ip}`, 8, 60_000)) return json({ error: "Too many tries. Wait a minute." }, 429);

  const body = await req.json().catch(() => ({}));
  if (!validInvite(body.code)) return json({ error: "That invite code isn't valid." }, 403);

  const email = normalizeEmail(body.email);
  const handle = cleanName(body.name);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!handle) return json({ error: "Pick a name of 2 to 24 letters or numbers." }, 400);
  if (body.track !== "creator" && body.track !== "client") {
    return json({ error: "Choose creator or project owner mode." }, 400);
  }
  if (!hasEmailAuthConfig()) {
    return json({ error: "Email sign-in isn't configured. Set the Supabase Auth environment variables." }, 503);
  }
  if (!limit(`invite-email:${email}`, 5, 60 * 60_000)) {
    return json({ error: "Too many codes requested for this email. Try again later." }, 429);
  }

  await prisma.pendingEmailAuth.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { handle }] },
    select: { email: true, handle: true },
  });
  if (existingUser?.email === email) {
    return json({ error: "An account already uses this email. Sign in instead." }, 409);
  }
  if (existingUser?.handle === handle) return json({ error: "That name is taken." }, 409);

  const existingPendingHandle = await prisma.pendingEmailAuth.findUnique({
    where: { handle },
    select: { email: true },
  });
  if (existingPendingHandle && existingPendingHandle.email !== email) {
    return json({ error: "That name is being claimed. Try another." }, 409);
  }

  await prisma.pendingEmailAuth.upsert({
    where: { email },
    create: {
      email,
      handle,
      accountTrack: body.track,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
    update: {
      handle,
      accountTrack: body.track,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });

  const { error } = await emailAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { handle } },
  });
  if (error) {
    console.error("Could not send signup email OTP", error.message);
    return json({ error: "Could not send a verification code. Try again shortly." }, 502);
  }

  return json({ ok: true, message: "Check your email for a verification code." });
}
