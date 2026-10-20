import { Prisma, PrismaClient } from "@prisma/client";
import { emailAuthClient, hasEmailAuthConfig, normalizeEmail } from "@/lib/server/emailAuth";
import { json, sameOrigin } from "@/lib/server/authz";
import { limit, ipOf } from "@/lib/server/ratelimit";
import { cookieFor, Session } from "@/lib/server/session";
import { profileFor } from "@/lib/server/registry";
import { cleanName } from "@/lib/server/invite";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.replace(/\s/g, "") : "";
  if (!email || !/^\d{6,8}$/.test(token)) {
    return json({ error: "Enter the email and verification code." }, 400);
  }
  if (!(await limit(`verify:${ipOf(req)}`, 12, 15 * 60_000)) ||
      !(await limit(`verify-email:${email}`, 6, 15 * 60_000))) {
    return json({ error: "Too many code attempts. Request a new code later." }, 429);
  }
  if (!hasEmailAuthConfig()) {
    return json({ error: "Email sign-in isn't configured. Set the Supabase Auth environment variables." }, 503);
  }

  const { data, error } = await emailAuthClient().auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error || !data.user?.email) {
    return json({ error: "That code is invalid or expired. Request a new one and try again." }, 401);
  }

  const normalized = normalizeEmail(data.user.email);
  if (!normalized) return json({ error: "Verified account has no valid email." }, 401);
  let user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    const pending = await prisma.pendingEmailAuth.findUnique({ where: { email: normalized } });
    if (!pending || pending.expiresAt.getTime() <= Date.now()) {
      if (pending) await prisma.pendingEmailAuth.delete({ where: { email: normalized } });
      return json({ error: "Your account setup expired. Start again with your email." }, 410);
    }

    try {
      if (pending.linkUid) {
        user = await prisma.user.update({
          where: { id: pending.linkUid },
          data: { email: normalized },
        });
      } else {
        const handle = cleanName(pending.handle);
        if (!handle) return json({ error: "The reserved name is no longer available. Contact support." }, 409);
        const handleOwner = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
        if (handleOwner) return json({ error: "That name was claimed while you were verifying. Start again with another name." }, 409);
        user = await prisma.user.create({
          data: {
            id: `inv_${data.user.id}`,
            email: normalized,
            handle,
            accountTrack: pending.accountTrack,
          },
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return json({ error: "That email or name is already linked to another account." }, 409);
      }
      throw error;
    }
    await prisma.pendingEmailAuth.delete({ where: { email: normalized } });
  }

  const track: Session["track"] = user.accountTrack === "client"
    ? "client"
    : user.accountTrack === "creator"
      ? "creator"
      : null;
  const session = { uid: user.id, handle: user.handle || normalized, track };
  return json(
    { account: { id: user.id, handle: session.handle, track }, profile: await profileFor(session) },
    200,
    cookieFor(session)
  );
}
