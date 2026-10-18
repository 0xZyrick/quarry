import { create } from "zustand";

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
  log: [...state.log.slice(-199), message],
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
      throw new Error(result.reason || result.error || "Message could not be sent.");
    }
    return true;
  } catch (error) {
    useChat.setState({
      error: error instanceof Error ? error.message : "Chat connection failed.",
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

export function connectChat(room: string): () => void {
  useChat.setState({
    log: [],
    requests: [],
    slots: [],
    connection: "connecting",
    error: "",
  });
  let dead = false;
  const source =
    typeof EventSource === "undefined"
      ? null
      : new EventSource(`/api/chat/${encodeURIComponent(room)}`);

  if (!source) {
    useChat.setState({
      connection: "offline",
      error: "Live chat is unavailable in this browser.",
    });
    return () => {};
  }

  const parse = (event: Event) =>
    JSON.parse((event as MessageEvent).data) as Record<string, unknown>;

  source.addEventListener("snapshot", (event) => {
    if (dead) return;
    const snapshot = parse(event);
    useChat.setState({
      connection: "server",
      error: "",
      log: (snapshot.log as Msg[]) || [],
      requests: (snapshot.requests as string[]) || [],
      slots: (snapshot.slots as string[]) || [],
    });
  });
  source.addEventListener("msg", (event) => {
    if (!dead) useChat.setState((state) => add(state, parse(event) as unknown as Msg));
  });
  source.addEventListener("mic", (event) => {
    if (!dead) {
      const update = parse(event);
      useChat.setState({
        requests: (update.requests as string[]) || [],
        slots: (update.slots as string[]) || [],
      });
    }
  });
  source.onerror = () => {
    if (dead) return;
    useChat.setState({
      connection: "offline",
      error: "Room chat disconnected. Reconnecting…",
    });
  };

  return () => {
    dead = true;
    source.close();
  };
}
