import { getIdentity } from "@/lib/identity";
import { json, sameOrigin } from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
import { isModerator } from "@/lib/server/session";
export const dynamic = "force-dynamic";
const ACTIONS = ["dismiss", "uphold", "ban", "reinstate", "mute", "roomban"] as const;
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const s = getIdentity(req).session;
  if (!isModerator(s)) return json({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => ({}));
  if (!ACTIONS.includes(b.action)) return json({ error: "bad action" }, 400);
  const r = await safety.decide(String(b.caseId ?? ""), s!.uid, b.action, String(b.note ?? ""));
  return r.ok ? json({ ok: true, case: r.case }) : json({ error: r.error }, r.code);
}
