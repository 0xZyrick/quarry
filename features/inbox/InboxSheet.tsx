"use client";
/**
 * Notifications + messaging — continuity (what happened while away)
 * and proximity (talk to someone you found in the world).
 */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShellUi } from "@/lib/shellUi";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { navigateToRoute } from "@/lib/appRoutes";

type Notif = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  read: boolean;
  createdAt: string;
  derived?: boolean;
};

type Conv = {
  id: string;
  others: { id: string; handle?: string | null; displayName?: string | null }[];
  lastMessage?: { body: string; createdAt: string; senderId: string } | null;
  unread?: boolean;
};

type Msg = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  sender?: { handle?: string | null };
};

export default function InboxSheet() {
  const open = useShellUi((s: any) => s.inboxOpen);
  const close = () => useShellUi.getState().closeInbox?.();
  const [tab, setTab] = useState<"alerts" | "messages">("alerts");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [toHandle, setToHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { signedIn, data: account } = useOnboarding();
  const uid = signedIn ? account.uid : null;

  useEffect(() => {
    const startMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ handle?: string }>).detail;
      if (!detail?.handle) return;
      setTab("messages");
      setActiveConv(null);
      setToHandle(detail.handle.replace(/^@/, ""));
      setDraft("");
    };
    window.addEventListener("wippo:message", startMessage);
    return () => window.removeEventListener("wippo:message", startMessage);
  }, []);

  const loadNotifs = useCallback(async () => {
    if (!uid) return;
    try {
      const r = await fetch(`/api/notifications?userId=${encodeURIComponent(uid)}`);
      if (!r.ok) throw new Error("Could not load notifications.");
      const d = await r.json();
      setNotifs(d.notifications || []);
      setUnread(d.unread || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    }
  }, [uid]);

  const loadConvs = useCallback(async () => {
    if (!uid) return;
    try {
      const r = await fetch(`/api/messages?userId=${encodeURIComponent(uid)}`);
      if (!r.ok) throw new Error("Could not load messages.");
      const d = await r.json();
      setConvs(d.conversations || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load messages.");
    }
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    loadNotifs();
    loadConvs();
  }, [open, loadNotifs, loadConvs]);

  useEffect(() => {
    if (!activeConv || !uid) return;
    fetch(`/api/messages?conversationId=${encodeURIComponent(activeConv)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load this conversation.");
        return r.json();
      })
      .then((d) => setMsgs(d.messages || []))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load this conversation."));
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, conversationId: activeConv }),
    }).then((response) => {
      if (!response.ok) throw new Error("Could not mark this conversation read.");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not mark this conversation read."));
  }, [activeConv, uid]);

  const markAllRead = async () => {
    if (!uid) return;
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, all: true }),
      });
      if (!response.ok) throw new Error("Could not mark notifications read.");
      await loadNotifs();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark notifications read.");
    }
  };

  const send = async () => {
    if (!uid || draft.trim().length < 1) return;
    setError("");
    setBusy(true);
    try {
      if (activeConv) {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: uid,
            conversationId: activeConv,
            body: draft.trim(),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Message could not be sent.");
        setDraft("");
        const r = await fetch(
          `/api/messages?conversationId=${encodeURIComponent(activeConv)}`
        );
        const d = await r.json();
        setMsgs(d.messages || []);
        loadConvs();
      } else if (toHandle.trim()) {
        // Resolve handle → user id via creators API
        const cr = await fetch(
          `/api/creators/${encodeURIComponent(toHandle.replace(/^@/, ""))}`
        );
        if (!cr.ok) throw new Error("User not found");
        const cd = await cr.json();
        const toUserId = cd.creator?.id;
        if (!toUserId) throw new Error("User not found");
        const r = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: uid,
            toUserId,
            body: draft.trim(),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Send failed");
        setDraft("");
        setToHandle("");
        setActiveConv(d.conversationId);
        loadConvs();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const timeAgo = (iso: string) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[80] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-label="Inbox"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="fixed z-[85] right-0 top-0 bottom-0 w-full sm:w-[min(100%,28rem)] border-l border-[var(--line)] bg-[var(--surface)] shadow-2xl flex flex-col"
          >
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 sm:px-5 pt-4 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">Stay in the loop</p>
                <h2 className="mt-1 text-[18px] font-semibold text-[var(--text)]">Inbox</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close inbox"
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"
              >
                ×
              </button>
            </div>
            {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</p>}

            <div className="shrink-0 flex gap-1 px-3 sm:px-4 pt-3 pb-2">
              {(
                [
                  ["alerts", "Alerts"],
                  ["messages", "Messages"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    setActiveConv(null);
                  }}
                  className={`relative rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    tab === id ? "text-[var(--text)] bg-white/[0.08]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                  }`}
                >
                  {label}
                  {id === "alerts" && unread > 0 && (
                    <span className="ml-1 text-[10px] text-[var(--coral)]">{unread}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
              {!uid && (
                <div className="mx-1 mt-5 rounded-2xl border border-[var(--line)] bg-white/[0.02] px-4 py-5 text-center">
                  <p className="text-[14px] font-semibold text-[var(--text)]">Keep the conversation close</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    Sign in to follow project updates and continue conversations with the people you build alongside.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "see your inbox" }))}
                    className="mt-4 rounded-full bg-[var(--coral)] px-4 py-2 text-[12px] font-semibold text-white hover:brightness-110"
                  >
                    Join or sign in
                  </button>
                </div>
              )}

              {uid && tab === "alerts" && (
                <div className="space-y-1.5">
                  {notifs.length > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] text-[var(--coral)] mb-2"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifs.length === 0 && (
                    <p className="text-[13px] text-white/40 py-8 text-center">
                      Quiet for now. Circle updates and messages show up here.
                    </p>
                  )}
                  {notifs.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        void (async () => {
                          setError("");
                          try {
                            const response = await fetch("/api/notifications", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: uid, ids: [n.id] }),
                            });
                            if (!response.ok) throw new Error("Could not mark notification read.");
                            if (n.href?.startsWith("message:")) {
                              setTab("messages");
                              setActiveConv(n.href.replace("message:", ""));
                            } else if (n.href?.startsWith("room:")) {
                              const projectId = n.href.slice("room:".length);
                              close();
                              navigateToRoute({ kind: "room", id: projectId });
                            } else if (n.href?.startsWith("project:")) {
                              const projectId = n.href.slice("project:".length);
                              close();
                              useShellUi.getState().openProject(projectId);
                            }
                            await loadNotifs();
                          } catch (cause) {
                            setError(cause instanceof Error ? cause.message : "Could not open this notification.");
                          }
                        })();
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 ${
                        n.read
                          ? "border-white/5 bg-white/[0.02]"
                          : "border-white/10 bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-white/30">
                          {n.type.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-white/30 ml-auto">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-white mt-0.5">{n.title}</p>
                      {n.body && (
                        <p className="text-[12px] text-white/45 line-clamp-2 mt-0.5">{n.body}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {uid && tab === "messages" && !activeConv && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-white/10 p-2.5 space-y-2">
                    <p className="text-[11px] text-white/40">New message</p>
                    <input
                      value={toHandle}
                      onChange={(e) => setToHandle(e.target.value)}
                      placeholder="@handle"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-[13px] text-white placeholder:text-white/30 outline-none"
                    />
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      placeholder="Say something useful…"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-[13px] text-white placeholder:text-white/30 outline-none resize-none"
                    />
                    <button
                      type="button"
                      disabled={busy || !toHandle.trim() || draft.trim().length < 1}
                      onClick={send}
                      className="w-full rounded-full py-2 text-[12px] font-semibold bg-[var(--coral)] text-white disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                  {convs.map((c) => {
                    const name =
                      c.others[0]?.displayName ||
                      c.others[0]?.handle ||
                      "Conversation";
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveConv(c.id)}
                        className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:border-white/20"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-white">@{name}</p>
                          {c.unread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
                          )}
                          {c.lastMessage && (
                            <span className="text-[10px] text-white/30 ml-auto">
                              {timeAgo(c.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        {c.lastMessage && (
                          <p className="text-[12px] text-white/40 line-clamp-1 mt-0.5">
                            {c.lastMessage.body}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {convs.length === 0 && (
                    <p className="text-[12px] text-white/35 text-center py-4">
                      No conversations yet. Message someone from a profile.
                    </p>
                  )}
                </div>
              )}

              {uid && tab === "messages" && activeConv && (
                <div className="flex flex-col h-full min-h-[20rem]">
                  <button
                    type="button"
                    onClick={() => setActiveConv(null)}
                    className="text-[12px] text-[var(--coral)] mb-2 self-start"
                  >
                    ← All messages
                  </button>
                  <div className="flex-1 space-y-2 overflow-y-auto mb-2">
                    {msgs.map((m) => {
                      const mine = m.senderId === uid;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${
                            mine
                              ? "ml-auto bg-[var(--coral)] text-white"
                              : "bg-white/10 text-white"
                          }`}
                        >
                          {m.body}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Message…"
                      className="flex-1 rounded-full bg-white/5 border border-white/10 px-3 py-2 text-[13px] text-white outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || draft.trim().length < 1}
                      onClick={send}
                      className="rounded-full px-4 py-2 text-[12px] font-semibold bg-[var(--coral)] text-white disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
