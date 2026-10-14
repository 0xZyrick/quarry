"use client";
/**
 * Network — Connect layer
 * Followed projects, meaningful progress updates, "what changed since you left".
 * Curiosity → Return → Relationship.
 */
import { useEffect, useState } from "react";
import { useGuild } from "@/lib/store";
import ProjectWorkspace from "./ProjectWorkspace";

type FollowItem = {
  followId: string;
  projectId: string;
  lastSeenAt: string;
  hasUpdates: boolean;
  newNodeCount: number;
  project: {
    id: string;
    title: string;
    intent: string;
    status: string;
    creator: { id: string; handle: string | null; levelTrack: string };
    updatedAt: string;
    latestNode: {
      dayLabel: string;
      phaseTitle: string;
      summary: string;
      evolutionDelta: string | null;
      createdAt: string;
      mediaUrl: string | null;
    } | null;
    newPhases: { dayLabel: string; phaseTitle: string; summary: string }[];
  };
};

export default function NetworkLayer({ onBack }: { onBack?: () => void }) {
  const profile = useGuild((s) => s.profile);
  const userId = (profile as any)?.id ?? profile?.handle ?? "";
  const [items, setItems] = useState<FollowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    if (!userId) { setLoading(false); return; }
    fetch(`/api/follows?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.follows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  const openProject = async (projectId: string) => {
    // Mark seen for Return loop
    if (userId) {
      fetch("/api/follows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      }).catch(() => {});
    }
    setOpenId(projectId);
  };

  if (openId) {
    return (
      <ProjectWorkspace
        projectId={openId}
        onClose={() => { setOpenId(null); load(); }}
      />
    );
  }

  const withUpdates = items.filter((i) => i.hasUpdates);
  const rest = items.filter((i) => !i.hasUpdates);

  return (
    <div className="absolute inset-0 overflow-y-auto px-3 py-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Following</h2>
          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
            Return to see what changed — not every minor action
          </p>
        </div>
        {onBack && (
          <button onClick={onBack} className="btn glass rounded-full px-3 py-1 font-mono text-[11px] text-neutral-300 hover:text-white">
            ← Mosaic
          </button>
        )}
      </div>

      {!userId && (
        <p className="text-center text-neutral-500 font-mono text-sm py-16">
          Sign in to follow projects and get progress updates.
        </p>
      )}

      {userId && loading && (
        <p className="text-center text-neutral-500 font-mono text-sm py-16">Loading…</p>
      )}

      {userId && !loading && items.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-neutral-400 font-mono text-sm">Not following any projects yet.</p>
          <p className="text-neutral-600 text-xs max-w-xs mx-auto">
            Discover a project on the Story Mosaic, open it, and tap Follow. You&apos;ll see meaningful phase updates here.
          </p>
          {onBack && (
            <button onClick={onBack} className="mt-4 btn glass rounded-full px-4 py-1.5 font-mono text-[11px] text-live">
              Browse Story Mosaic
            </button>
          )}
        </div>
      )}

      {withUpdates.length > 0 && (
        <section className="mb-6">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-live mb-2">
            New since you left · {withUpdates.length}
          </h3>
          <ul className="space-y-3">
            {withUpdates.map((item) => (
              <FollowCard key={item.followId} item={item} highlight onOpen={() => openProject(item.projectId)} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
            Following · {rest.length}
          </h3>
          <ul className="space-y-3">
            {rest.map((item) => (
              <FollowCard key={item.followId} item={item} onOpen={() => openProject(item.projectId)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FollowCard({
  item,
  highlight,
  onOpen,
}: {
  item: FollowItem;
  highlight?: boolean;
  onOpen: () => void;
}) {
  const p = item.project;
  const node = p.latestNode;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left rounded-xl border p-3 transition-colors ${
          highlight ? "border-live/40 bg-live/5" : "border-white/8 bg-card/40 hover:border-white/15"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white truncate">{p.title}</p>
            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
              @{p.creator.handle ?? "anon"} · {p.status.replace("_", " ")}
            </p>
          </div>
          {highlight && (
            <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-live/90 text-black">
              {item.newNodeCount} new
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-400 line-clamp-1">
          <span className="text-neutral-500">Intent · </span>{p.intent}
        </p>
        {node && (
          <p className="mt-1.5 text-[11px] text-live/90 font-mono">
            {node.dayLabel} · {node.phaseTitle}
            {node.evolutionDelta ? ` — Δ ${node.evolutionDelta}` : ""}
          </p>
        )}
        {item.newPhases.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
            {item.newPhases.slice(0, 3).map((ph, i) => (
              <li key={i} className="text-[10px] text-neutral-400">
                <span className="text-neutral-500 font-mono">{ph.dayLabel}</span> {ph.phaseTitle}: {ph.summary.slice(0, 60)}
                {ph.summary.length > 60 ? "…" : ""}
              </li>
            ))}
          </ul>
        )}
      </button>
    </li>
  );
}
