import { emailAuthClient, hasEmailAuthConfig, normalizeEmail } from "@/lib/server/emailAuth";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!(await limit(`signin:${ipOf(req)}`, 8, 60 * 60_000)) ||
      !(await limit(`signin-email:${email}`, 5, 60 * 60_000))) {
    return json({ error: "Too many codes requested. Try again later." }, 429);
  }

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!account) {
    return json({ ok: true, message: "If the email belongs to an account, a sign-in code is on its way." });
  }
  if (!hasEmailAuthConfig()) {
    return json({ error: "Email sign-in isn't configured. Set the Supabase Auth environment variables." }, 503);
  }

  const auth = emailAuthClient();
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    console.error("Could not send sign-in email OTP", error.message);
    return json({ error: "Could not send a sign-in code. Try again shortly." }, 502);
  }

  return json({ ok: true, message: "If the email belongs to an account, a sign-in code is on its way." });
}
