import { authorize, json, sameOrigin } from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
export const dynamic = "force-dynamic";
// POST {room, kind:"stream"|"user", reason, target?}. Needs a signed-in account; anonymous cookies are too cheap to count.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => ({}));
  const a = await authorize(req, String(b.room ?? ""));
  if (!a) return json({ error: "no such room" }, 404);
  if (!a.idt.session) return json({ error: "sign in to report" }, 401);
  if (!safety.isReason(b.reason) || (b.kind !== "stream" && b.kind !== "user"))
    return json({ error: "bad report" }, 400);
  const r = await safety.report({
    room: a.room.id,
    uid: a.idt.session.uid,
    kind: b.kind,
    reason: b.reason,
    target: typeof b.target === "string" ? b.target : null,
  });
  return r.ok ? json({ status: r.status }) : json({ error: r.error }, r.code);
}
