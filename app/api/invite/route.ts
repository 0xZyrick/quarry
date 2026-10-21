import { PrismaClient } from "@prisma/client";
import { emailAuthClient, hasEmailAuthConfig, normalizeEmail } from "@/lib/server/emailAuth";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";
import { cleanName } from "@/lib/server/invite";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = ipOf(req);
  if (!(await limit(`signup:${ip}`, 8, 60_000))) return json({ error: "Too many tries. Wait a minute." }, 429);

  const body = await req.json().catch(() => ({}));

  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  // Handle is optional at signup — a temporary one is used until the user picks a username after OTP.
  let handle = cleanName(body.name);
  if (!handle) {
    const local = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user";
    handle = `${local}${Date.now().toString(36).slice(-4)}`.slice(0, 24);
  }
  const track = body.track === "client" ? "client" : "creator";
  if (!hasEmailAuthConfig()) {
    return json({ error: "Email sign-in isn't configured. Set the Supabase Auth environment variables." }, 503);
  }
  if (!(await limit(`signup-email:${email}`, 5, 60 * 60_000))) {
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
      accountTrack: track,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
    update: {
      handle,
      accountTrack: track,
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
