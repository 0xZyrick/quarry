import { getIdentity } from "@/lib/identity";
import { json } from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
import { isModerator } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!isModerator(getIdentity(req).session)) return json({ error: "forbidden" }, 403);
  return json({ queue: await safety.queue(), audit: await safety.auditTail() });
}
