import { authorize, json, sameOrigin } from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
import * as chat from "@/lib/server/chat";
import { isModerator } from "@/lib/server/session";
export const dynamic = "force-dynamic";
// POST {room, op:"mute"|"unmute"|"ban"|"unban", handle}. The host moderates their own room (spec: the host can mute participants). Moderators can act anywhere.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => ({}));
  const a = await authorize(req, String(b.room ?? ""));
  if (!a) return json({ error: "no such room" }, 404);
  if (a.kind !== "owner-creator" && !isModerator(a.idt.session))
    return json({ error: "only the host or a moderator" }, 403);
  if (!["mute", "unmute", "ban", "unban"].includes(b.op)) return json({ error: "bad op" }, 400);
  const uid = chat.uidOf(a.room.id, String(b.handle ?? ""));
  if (!uid) return json({ error: "nobody by that name has spoken here" }, 404);
  const r = await safety.roomControl(a.room.id, b.op, uid, a.idt.session?.uid ?? a.idt.id);
  if (r.ok)
    await chat.system(
      a.room.id,
      `@${b.handle} was ${b.op === "mute" ? "muted" : b.op === "unmute" ? "unmuted" : b.op === "ban" ? "removed from the room" : "allowed back"}`
    );
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.code);
}
