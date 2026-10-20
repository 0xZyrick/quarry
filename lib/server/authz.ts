// One place every API route asks "who is this, and what may they do in this room". Uses the same kindIn/capsOf as the UI.
import { getIdentity } from "../identity";
import { getRoom, profileFor, hubOf } from "./registry";
import { kindIn, capsOf } from "../access";
import * as safety from "./safety";
import * as chat from "./chat";

safety.bindChat(chat.uidOf);

export async function authorize(req: Request, roomId: string) {
  const idt = getIdentity(req);
  const room = await getRoom(roomId);
  if (!room) return null;
  if (idt.session) await safety.touch(idt.session.uid);
  const profile = await profileFor(idt.session);
  const kind = kindIn(profile, { id: room.id, ownerId: room.id, type: room.type });
  const visiting = !!profile?.creatorNodeId && profile.creatorNodeId !== room.id;
  const hub = await hubOf(room.id);
  // A Silent Focus Bench is watch-only for guests: no chat, no mic requests.
  const quiet = hub.meta?.env === "focus" && kind === "guest";
  const base = capsOf(kind, room.type, visiting);
  const banned =
    (await safety.isBanned(idt.session?.uid)) ||
    (await safety.isRoomBanned(room.id, idt.id));
  return {
    idt,
    room,
    profile,
    kind,
    caps: quiet ? { ...base, chat: false, requestMic: false } : base,
    // dark to everyone but its owner while held; banned accounts and room-banned accounts see nothing
    hidden: (hub.suspended && kind !== "owner-creator") || banned,
  };
}

export const json = (b: unknown, status = 200, cookie?: string) =>
  new Response(JSON.stringify(b), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });

export const sameOrigin = (req: Request) => {
  const o = req.headers.get("origin");
  return !o || new URL(o).host === req.headers.get("host");
};
