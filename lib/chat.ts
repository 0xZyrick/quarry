import { create } from "zustand";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type Msg = {
  id: string;
  room: string;
  kind: "text" | "system";
  by: string;
  text: string;
  t: number;
  question?: boolean;
};

type Connection = "connecting" | "server" | "offline";
type ChatState = {
  log: Msg[];
  requests: string[];
  slots: string[];
  connection: Connection;
  error: string;
  say: (room: string, by: string, text: string) => Promise<boolean>;
  system: (room: string, text: string) => void;
  requestMic: (room: string, by: string) => void;
  cancelMicRequest: (room: string, by: string) => void;
  passMic: (room: string, by: string) => boolean;
  revokeMic: (room: string, by: string) => void;
  reset: () => void;
};

const id = () => Math.random().toString(36).slice(2);
const add = (state: ChatState, message: Msg) => ({
  log: [...state.log.filter((m) => m.id !== message.id).slice(-199), message],
});

async function post(room: string, body: object) {
  try {
    const response = await fetch(`/api/chat/${encodeURIComponent(room)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(
        result.reason || result.error || "Message could not be sent."
      );
    }
    // Optimistic: if server returned the msg, fold it in immediately
    if (result.msg) {
      useChat.setState((state) => add(state, result.msg as Msg));
    }
    return true;
  } catch (error) {
    useChat.setState({
      error:
        error instanceof Error ? error.message : "Chat connection failed.",
    });
    return false;
  }
}

export const useChat = create<ChatState>((set, get) => ({
  log: [],
  requests: [],
  slots: [],
  connection: "offline",
  error: "",
  say: async (room, _by, text) => {
    const cleanText = text.trim().slice(0, 240);
    if (!cleanText) return false;
    if (get().connection !== "server") {
      set({ error: "Room chat is reconnecting. Your message was not sent." });
      return false;
    }
    set({ error: "" });
    return post(room, { type: "say", text: cleanText });
  },
  system: (room, text) => {
    set((state) =>
      add(state, {
        id: id(),
        room,
        kind: "system",
        by: "system",
        text,
        t: Date.now(),
      })
    );
  },
  requestMic: (room) => {
    void post(room, { type: "requestMic" });
  },
  cancelMicRequest: (room) => {
    void post(room, { type: "cancelMicRequest" });
  },
  passMic: (room, by) => {
    void post(room, { type: "passMic", target: by });
    return true;
  },
  revokeMic: (room, by) => {
    void post(room, { type: "revokeMic", target: by });
  },
  reset: () => set({ log: [], requests: [], slots: [], error: "" }),
}));

function applySnapshot(snapshot: {
  log?: Msg[];
  requests?: string[];
  slots?: string[];
}) {
  useChat.setState({
    connection: "server",
    error: "",
    log: snapshot.log || [],
    requests: snapshot.requests || [],
    slots: snapshot.slots || [],
  });
}

async function fetchSnapshot(room: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/chat/${encodeURIComponent(room)}`, {
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error("snapshot failed");
    const data = await res.json();
    applySnapshot(data);
    return true;
  } catch {
    useChat.setState({
      connection: "offline",
      error: "Room chat disconnected. Reconnecting…",
    });
    return false;
  }
}

let browserSupabase: SupabaseClient | null = null;
function getBrowserSupabase(): SupabaseClient | null {
  if (browserSupabase) return browserSupabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === "undefined") return null;
  browserSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return browserSupabase;
}

/**
 * Connect to room chat.
 * 1. Load snapshot via GET
 * 2. Subscribe to Supabase Realtime broadcast on `room:{id}` when keys exist
 * 3. Light poll (25s, tab visible only) as free-tier safety net
 */
/** One live connection per room — extra mounts share it. */
let activeRoom: string | null = null;
let activeCleanup: (() => void) | null = null;
let activeRefCount = 0;

export function connectChat(room: string): () => void {
  if (activeRoom === room && activeCleanup) {
    activeRefCount += 1;
    return () => {
      activeRefCount = Math.max(0, activeRefCount - 1);
      if (activeRefCount === 0 && activeCleanup) {
        activeCleanup();
        activeCleanup = null;
        activeRoom = null;
      }
    };
  }
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
    activeRoom = null;
    activeRefCount = 0;
  }

  useChat.setState({
    log: [],
    requests: [],
    slots: [],
    connection: "connecting",
    error: "",
  });

  let dead = false;
  let channel: RealtimeChannel | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  activeRoom = room;
  activeRefCount = 1;

  const start = async () => {
    await fetchSnapshot(room);
    if (dead) return;

    const sb = getBrowserSupabase();
    if (sb) {
      channel = sb.channel(`room:${room}`, {
        config: { broadcast: { self: false } },
      });
      channel
        .on("broadcast", { event: "msg" }, ({ payload }) => {
          if (dead || !payload) return;
          useChat.setState((state) => add(state, payload as Msg));
        })
        .on("broadcast", { event: "mic" }, ({ payload }) => {
          if (dead || !payload) return;
          const update = payload as { requests?: string[]; slots?: string[] };
          useChat.setState({
            requests: update.requests || [],
            slots: update.slots || [],
          });
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && !dead) {
            useChat.setState({ connection: "server", error: "" });
          }
        });
    }

    // Polling fallback (slow — Realtime is primary when configured)
    const poll = () => {
      if (dead) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchSnapshot(room);
    };
    pollTimer = setInterval(poll, 25000);
  };

  void start();

  const cleanup = () => {
    dead = true;
    if (pollTimer) clearInterval(pollTimer);
    if (channel) {
      const sb = getBrowserSupabase();
      void sb?.removeChannel(channel);
    }
    if (activeRoom === room) {
      activeRoom = null;
      activeCleanup = null;
      activeRefCount = 0;
    }
  };
  activeCleanup = cleanup;

  return () => {
    activeRefCount = Math.max(0, activeRefCount - 1);
    if (activeRefCount === 0) cleanup();
  };
}
