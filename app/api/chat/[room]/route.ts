import { authorize, json, sameOrigin } from "@/lib/server/authz";
import * as chat from "@/lib/server/chat";
import * as safety from "@/lib/server/safety";
import { setPublish } from "@/lib/server/livekitPerms";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET: chat snapshot (log + mic state).
 * Clients use this for the initial load and as a polling fallback when Realtime is unavailable.
 */
export async function GET(req: Request, { params }: { params: { room: string } }) {
  const a = await authorize(req, params.room);
  if (!a || a.hidden) return json({ error: "not found" }, 404);
  if (a.idt.session) await safety.enter(a.room.id, a.idt.session.uid);
  const snap = await chat.snapshot(a.room.id);
  return json(snap, 200, a.idt.setCookie);
}

/**
 * POST {type:"say"|"requestMic"|"cancelMicRequest"|"passMic"|"revokeMic"}.
 * The speaker's name always comes from the session, never from the body.
 */
export async function POST(req: Request, { params }: { params: { room: string } }) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const a = await authorize(req, params.room);
  if (!a || a.hidden) return json({ error: "not found" }, 404);
  const b = await req.json().catch(() => ({}));
  const room = a.room.id;
  const { id, name } = a.idt;

  switch (b.type) {
    case "say": {
      if (!a.caps.chat) return json({ ok: false, reason: "quiet room" }, 403);
      const why = await safety.screen(room, id, String(b.text ?? ""));
      if (why)
        return json(
          { ok: false, reason: why },
          why === "duplicate" ? 429 : 403
        );
      const msg = await chat.say(room, id, name, String(b.text ?? ""));
      return json({ ok: !!msg, msg: msg ?? undefined }, 200, a.idt.setCookie);
    }
    case "requestMic":
      if (!a.caps.requestMic) return json({ error: "forbidden" }, 403);
      await chat.requestMic(room, id, name);
      return json({ ok: true });
    case "cancelMicRequest":
      if (!a.caps.requestMic) return json({ error: "forbidden" }, 403);
      return json({ ok: await chat.cancelMicRequest(room, id, name) });
    case "passMic": {
      if (!a.caps.passMic) return json({ error: "forbidden" }, 403);
      const uid = await chat.passMic(room, String(b.target ?? ""));
      if (!uid) return json({ ok: false }, 409);
      await setPublish(room, uid, ["microphone"]);
      return json({ ok: true });
    }
    case "revokeMic": {
      if (!a.caps.passMic) return json({ error: "forbidden" }, 403);
      const uid = await chat.revokeMic(room, String(b.target ?? ""));
      if (uid) await setPublish(room, uid, []);
      return json({ ok: true });
    }
  }
  return json({ error: "bad type" }, 400);
}
