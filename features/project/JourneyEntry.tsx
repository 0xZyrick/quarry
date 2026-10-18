"use client";
import { useEffect, useState, useRef } from "react";
import {
  IconReact,
  IconReactFilled,
  IconChat,
  IconUserPlus,
  IconCheck,
} from "../shared/Icons";
import { toggleCircle, isInCircle, currentUid } from "@/lib/circle";
import { projectCaps } from "@/lib/projectAccess";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";
import { useGuild } from "@/lib/store";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import Avatar from "../shared/Avatar";

export type EntryData = {
  nodeId?: string;
  projectId: string;
  projectTitle: string;
  handle: string;
  creatorId?: string;
  summary: string;
  body?: string | null;
  phaseTitle?: string | null;
  dayLabel?: string | null;
  mediaUrl?: string | null;
  thumbUrl?: string | null;
  prevUrl?: string | null;
  nextUrl?: string | null;
  hasVideo?: boolean;
  updatedAt?: string;
  evolutionDelta?: string | null;
  decisions?: { label: string; detail?: string; done?: boolean }[];
  related?: EntryData[];
};

type ContribType = "SUGGESTION" | "CRITIQUE" | "ENCOURAGEMENT";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Journey entry — media-first.
 * Desktop: ~65% media + info + pinned discuss | ~35% related from project.
 * Mobile: stacked media → context → actions → discuss.
 */
export default function JourneyEntry({
  entry,
  onClose,
  onOpenWorkspace,
}: {
  entry: EntryData;
  onClose: () => void;
  onOpenWorkspace: () => void;
}) {
  const { signedIn, requireAuth } = useOnboarding() as any;
  const [reacted, setReacted] = useState(false);
  // Real counts only — no seeded fake likes
  const [reactCount, setReactCount] = useState(0);
  const [inCircle, setInCircle] = useState(false);
  const [message, setMessage] = useState("");
  const [ctype, setCtype] = useState<ContribType>("SUGGESTION");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [gallery, setGallery] = useState(0);
  const [expanded, setExpanded] = useState(false);
  type ChatMsg = { id: string; text: string; type: ContribType; at: number; mine?: boolean };
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [needsMore, setNeedsMore] = useState(false);
  const bodyText = (entry.body || entry.evolutionDelta || "").trim();

  const { caps } = projectCaps(entry.creatorId);

  const slides: string[] = [];
  if (entry.hasVideo && entry.mediaUrl) {
    /* video handled separately */
  } else {
    if (entry.mediaUrl) slides.push(entry.mediaUrl);
    if (entry.thumbUrl && entry.thumbUrl !== entry.mediaUrl) slides.push(entry.thumbUrl);
    if (entry.prevUrl && !slides.includes(entry.prevUrl)) slides.push(entry.prevUrl);
    if (entry.nextUrl && !slides.includes(entry.nextUrl)) slides.push(entry.nextUrl);
  }
  const isVideo = !!(entry.hasVideo && entry.mediaUrl);
  const currentImg = slides[gallery] || entry.thumbUrl || entry.mediaUrl || null;

  useEffect(() => {
    useShellUi.getState().setHideMainNav(true);
    return () => {
      useShellUi.getState().setHideMainNav(false);
      // Clear stuck spatial transition so feed/map respond after leaving journey
      useGuild.setState({ dive: null, trans: null });
    };
  }, []);

  useEffect(() => {
    setInCircle(isInCircle(entry.projectId));
    setChat([]);
    setReacted(false);
    setReactCount(0);
  }, [entry.projectId, entry.nodeId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  useEffect(() => {
    setExpanded(false);
  }, [entry.nodeId, entry.summary, bodyText]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !bodyText) {
      setNeedsMore(false);
      return;
    }
    // Only show "see more" when clamped text actually overflows 2 lines
    if (expanded) return;
    setNeedsMore(el.scrollHeight > el.clientHeight + 1);
  }, [bodyText, expanded, entry.nodeId]);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 2) return;
    if (!signedIn) {
      requireAuth?.("join the conversation");
      return;
    }
    if (!entry.nodeId) return;
    setSending(true);
    const optimistic: ChatMsg = {
      id: `local-${Date.now()}`,
      text,
      type: ctype,
      at: Date.now(),
      mine: true,
    };
    setChat((c) => [...c, optimistic]);
    setMessage("");
    try {
      const r = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyNodeId: entry.nodeId,
          userId: currentUid() || "guest",
          type: ctype,
          messageText: text,
        }),
      });
      if (r.ok) {
        setSentOk(true);
        setTimeout(() => setSentOk(false), 2000);
      } else {
        setChat((c) => c.filter((m) => m.id !== optimistic.id));
      }
    } catch {
      setChat((c) => c.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const hasMedia = !!(isVideo || currentImg);
  const secondSlide = slides.length > 1 ? slides[1] : null;

  const chatLogPanel = (
    <div className="flex flex-col h-full min-h-[200px] bg-[var(--surface)] border border-[var(--line)] rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--line)] flex items-center gap-1.5 shrink-0">
        <IconChat size={14} />
        <span className="text-[12px] font-medium text-[var(--text)]">Discuss</span>
        <span className="text-[10px] text-[var(--text-faint)] ml-auto tabular-nums">
          {chat.length ? `${chat.length}` : "open"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {chat.length === 0 && (
          <p className="text-[12px] text-[var(--text-faint)] py-6 text-center leading-relaxed">
            No messages yet.
            <br />
            Share a note, critique, or encouragement.
          </p>
        )}
        {chat.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl px-2.5 py-2 text-[12px] max-w-[95%] ${
              m.mine
                ? "ml-auto bg-[var(--coral)]/15 text-[var(--text)]"
                : "bg-[var(--page)] text-[var(--text-muted)] border border-[var(--line)]"
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            <p className="text-[10px] text-[var(--text-faint)] mt-1 capitalize">
              {m.type.toLowerCase()}
            </p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );

  const mediaBlock = (
    <div className="relative w-full">
      {/* Side-by-side: media | second media OR chat log when no second asset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative bg-black rounded-xl overflow-hidden border border-[var(--line)] aspect-video sm:aspect-[16/10] max-h-[55vh] bg-[var(--surface-2)]">
          {isVideo ? (
            <video
              src={entry.mediaUrl!}
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : currentImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImg}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-[var(--text-faint)]">
              Work in progress
            </div>
          )}
        </div>
        <div className="hidden sm:block min-h-0 max-h-[55vh]">
          {secondSlide ? (
            <div className="relative h-full bg-black rounded-xl overflow-hidden border border-[var(--line)] aspect-video sm:aspect-[16/10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={secondSlide}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="h-full min-h-[180px]">{chatLogPanel}</div>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="flex gap-1.5 justify-center py-2">
          {slides.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setGallery(i)}
              className={`h-10 w-10 rounded-md overflow-hidden border ${
                i === gallery ? "border-[var(--coral)]" : "border-transparent opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const metaBlock = (
    <div className="space-y-2">
      {/* Actions directly under media */}
      <div className="flex items-center gap-1">
        {caps.react && (
          <button
            type="button"
            onClick={() => {
              setReacted((r) => {
                setReactCount((c) => Math.max(0, r ? c - 1 : c + 1));
                return !r;
              });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] ${
              reacted ? "text-[var(--coral)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
            aria-label={reacted ? "Remove reaction" : "React"}
          >
            {reacted ? <IconReactFilled size={16} /> : <IconReact size={16} />}
            {reactCount > 0 && <span className="tabular-nums">{reactCount}</span>}
          </button>
        )}
        {caps.follow && (
          <button
            type="button"
            onClick={async () => {
              const next = await toggleCircle(entry.projectId, inCircle);
              setInCircle(next);
            }}
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium ${
              inCircle
                ? "bg-white/10 text-[var(--text)]"
                : "bg-[var(--coral)]/15 text-[var(--coral)]"
            }`}
          >
            {inCircle ? <IconCheck size={12} /> : <IconUserPlus size={12} />}
            <span>{inCircle ? "In Circle" : "Circle"}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <Avatar handle={entry.handle} size={28} />
        <button
          type="button"
          onClick={() => useShellUi.getState().openVault(entry.handle)}
          className="font-medium text-[var(--text)] hover:text-[var(--coral)]"
        >
          @{entry.handle}
        </button>
        <span className="text-[var(--text-faint)]">·</span>
        <button type="button" onClick={() => navigateToRoute({ kind: "project", id: entry.projectId })} className="hover:text-[var(--cream)] truncate">
          {entry.projectTitle}
        </button>
        {entry.updatedAt && (
          <>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-faint)] shrink-0">{timeAgo(entry.updatedAt)}</span>
          </>
        )}
      </div>

      <h1 className="text-[16px] sm:text-[18px] font-semibold text-[var(--text)] leading-snug">
        {entry.summary}
      </h1>

      {bodyText && (
        <div>
          <p
            ref={bodyRef}
            className={`text-[13px] text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap ${
              !expanded ? "line-clamp-2" : ""
            }`}
          >
            {bodyText}
          </p>
          {needsMore && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[12px] font-medium text-[var(--coral)] hover:opacity-90"
            >
              {expanded ? "Show less" : "… see more"}
            </button>
          )}
        </div>
      )}

      {entry.decisions && entry.decisions.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {entry.decisions.map((d, i) => (
            <li key={i} className="text-[12px] text-[var(--text-muted)] flex gap-2">
              <span className={d.done ? "text-[var(--growth)]" : ""}>{d.done ? "✓" : "·"}</span>
              <span>
                <span className="text-[var(--text)] font-medium">{d.label}</span>
                {d.detail && <span className="block text-[var(--text-faint)]">{d.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const discussBlock = (
    <div className="border border-[var(--line)] rounded-2xl bg-[var(--surface)] overflow-hidden flex flex-col max-h-[min(40vh,320px)]">
      {/* Mobile / composer: show log when second media fills the side slot */}
      <div className={`flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[72px] ${secondSlide ? "" : "sm:hidden"}`}>
        {chat.length === 0 && (
          <p className="text-[12px] text-[var(--text-faint)] py-3 text-center">
            Start the discussion — notes stay on this update.
          </p>
        )}
        {chat.map((m) => (
          <div
            key={`c-${m.id}`}
            className={`rounded-xl px-2.5 py-2 text-[12px] max-w-[95%] ${
              m.mine
                ? "ml-auto bg-[var(--coral)]/15 text-[var(--text)]"
                : "bg-[var(--page)] text-[var(--text-muted)] border border-[var(--line)]"
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[var(--line)] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Share something useful…"
            className="flex-1 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            disabled={sending || message.trim().length < 2}
            onClick={submit}
            className="shrink-0 z-10 rounded-full px-4 py-2.5 text-[12px] font-semibold bg-[var(--coral)] text-white disabled:opacity-40 shadow-lg"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        {sentOk && <p className="mt-1.5 text-[11px] text-[var(--growth)]">Sent.</p>}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-20 bg-[var(--page)] flex flex-col">
      {/* Desktop split / mobile stack — top padding clears global TopBar */}
      <div className="flex-1 min-h-0 overflow-hidden pt-[4.25rem]">
        <div className="h-full w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-0 lg:gap-6 px-3 sm:px-5 lg:px-6 pb-28 lg:pb-6">
          {/* Left ~65% */}
          <div className="flex-1 min-w-0 lg:w-[62%] flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto space-y-3 pb-3">
              {mediaBlock}
              {metaBlock}
            </div>
            {/* Discuss pinned above context nav (Back · Journey · Project) */}
            <div className="shrink-0 pt-2 border-t border-[var(--line)] mt-auto pb-[4.75rem] lg:pb-2 bg-[var(--page)]">
              {discussBlock}
            </div>
          </div>

          {/* Right ~35% — related / project */}
          <aside className="hidden lg:flex lg:w-[35%] flex-col min-h-0 border-l border-[var(--line)] pl-4">
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 mb-3 hover:border-[var(--line-strong)]"
            >
              <p className="text-[11px] text-[var(--text-faint)]">Project</p>
              <p className="text-[13px] font-semibold text-[var(--text)]">{entry.projectTitle}</p>
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">
              More from this project
            </p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(entry.related || []).length === 0 && (
                <p className="text-[12px] text-[var(--text-faint)] py-4">
                  No other updates yet
                </p>
              )}
              {(entry.related || []).map((r) => (
                <button
                  key={r.nodeId || r.summary}
                  type="button"
                  className="w-full text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden flex gap-2 hover:border-[var(--line-strong)]"
                >
                  {(r.thumbUrl || r.mediaUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbUrl || r.mediaUrl || ""}
                      alt=""
                      className="w-16 h-16 object-cover shrink-0"
                    />
                  )}
                  <span className="py-2 pr-2 min-w-0">
                    <span className="block text-[12px] font-medium text-[var(--text)] line-clamp-2">
                      {r.summary}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* Mobile project chip */}
          <div className="lg:hidden pt-3">
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="w-full text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
            >
              <p className="text-[11px] text-[var(--text-faint)]">Project</p>
              <p className="text-[13px] font-semibold text-[var(--text)]">{entry.projectTitle}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Context nav: Back · Journey · Project */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--page)]/95 backdrop-blur-md px-1 py-1 shadow-xl ring-1 ring-white/[0.04]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[12px] font-medium text-[var(--coral)] hover:bg-[var(--coral)]/10"
          >
            <span aria-hidden className="text-[14px] leading-none">←</span>
            Back
          </button>
          <span className="rounded-full px-3 py-2 text-[12px] font-semibold text-[var(--cream)] relative">
            Journey
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 h-0.5 w-4 rounded-full bg-[var(--coral)]" />
          </span>
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="rounded-full px-3 py-2 text-[12px] text-[var(--text-muted)] hover:text-[var(--cream)]"
          >
            Project
          </button>
        </div>
      </nav>
    </div>
  );
}
