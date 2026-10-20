import { authorize, json, sameOrigin } from "@/lib/server/authz";
import { addCrew, removeCrew } from "@/lib/server/registry";
import { system } from "@/lib/server/chat";
import { setPublish } from "@/lib/server/livekitPerms";
export const dynamic = "force-dynamic";
// POST {uid,handle}: the host seats a co-creator (Commons only). DELETE: a co-creator leaves the table.
export async function POST(req: Request, { params }: { params: { room: string } }) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const a = await authorize(req, params.room);
  if (!a) return json({ error: "not found" }, 404);
  if (a.kind !== "owner-creator" || !a.caps.addCrew)
    return json({ error: "only a Commons host can add crew" }, 403);
  const { uid, handle } = await req.json().catch(() => ({}));
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{3,72}$/.test(uid))
    return json({ error: "bad uid" }, 400);
  await addCrew(a.room.id, uid);
  await system(a.room.id, `@${String(handle ?? "crew").slice(0, 32)} was invited to the table`);
  return json({ ok: true });
}
export async function DELETE(req: Request, { params }: { params: { room: string } }) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const a = await authorize(req, params.room);
  if (!a) return json({ error: "not found" }, 404);
  if (a.kind !== "co-creator" || !a.idt.session) return json({ error: "not seated" }, 403);
  await removeCrew(a.room.id, a.idt.session.uid);
  await setPublish(a.room.id, a.idt.id, []);
  await system(a.room.id, `@${a.idt.name} left the table`);
  return json({ ok: true });
}
