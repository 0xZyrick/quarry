import { AccessToken } from "livekit-server-sdk";
import { authorize } from "@/lib/server/authz";
import { hubOf } from "@/lib/server/registry";
import { hasSlot } from "@/lib/server/chat";
export const dynamic = "force-dynamic";
const ROOM = /^guild-[A-Za-z0-9:_-]{1,48}$/;
const json = (b: unknown, status: number, cookie?: string) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json", ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
export async function POST(req: Request) {
  const o = req.headers.get("origin");
  if (o && new URL(o).host !== req.headers.get("host")) return json({ error: "forbidden" }, 403);
  const key = process.env.LIVEKIT_API_KEY,
    secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) return json({ error: "LiveKit keys not set" }, 500);
  const { room } = await req.json().catch(() => ({}));
  if (typeof room !== "string" || !ROOM.test(room)) return json({ error: "invalid room" }, 400);
  const a = await authorize(req, room.slice(6));
  if (!a || a.hidden) return json({ error: "not found" }, 404);
  const u = a.idt,
    c = a.caps,
    live = (await hubOf(a.room.id)).live;
  // Sources by role. The owner gets the camera only after the Active Canvas gate is passed (live=true); a guest publishes only while holding a mic slot.
  const sources: ("camera" | "microphone" | "screen_share")[] =
    a.kind === "owner-creator"
      ? live
        ? ["camera", "microphone", "screen_share"]
        : ["microphone", "screen_share"]
      : c.voice || c.pushToTalk || await hasSlot(a.room.id, u.id)
        ? ["microphone"]
        : [];
  const at = new AccessToken(key, secret, { identity: u.id, name: u.name, ttl: "10m" });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: sources.length > 0,
    canPublishSources: sources as any,
    canSubscribe: true,
    canPublishData: false,
  });
  return json({ token: await at.toJwt() }, 200, u.setCookie);
}
