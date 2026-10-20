"use client";
/**
 * Cmd/Ctrl+K spotlight — jump to projects, rooms, handles, or filters.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { navigateToRoute } from "@/lib/appRoutes";
import { useShellUi } from "@/lib/shellUi";

type Hit = {
  id: string;
  kind: "project" | "room" | "profile" | "filter" | "action";
  title: string;
  subtitle?: string;
  run: () => void;
};

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const staticHits = useMemo<Hit[]>(
    () => [
      {
        id: "f-live",
        kind: "filter",
        title: "Filter: Live now",
        subtitle: "Discover · live sessions",
        run: () => {
          navigateToRoute({ kind: "discover" });
          onClose();
        },
      },
      {
        id: "f-help",
        kind: "filter",
        title: "Filter: Needs a hand",
        subtitle: "Discover · bottlenecks",
        run: () => {
          navigateToRoute({ kind: "discover" });
          onClose();
        },
      },
      {
        id: "a-studio",
        kind: "action",
        title: "Go to Studio",
        subtitle: "Your launchpad",
        run: () => {
          navigateToRoute({ kind: "studio" });
          onClose();
        },
      },
      {
        id: "a-discover",
        kind: "action",
        title: "Go to Discover",
        subtitle: "Network feed",
        run: () => {
          navigateToRoute({ kind: "discover" });
          onClose();
        },
      },
    ],
    [onClose]
  );

  const search = useCallback(
    async (query: string) => {
      const needle = query.trim().toLowerCase();
      if (!needle) {
        setHits(staticHits);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/projects?status=IN_PROGRESS");
        const data = await res.json().catch(() => ({}));
        const projects = data.projects || [];
        const projectHits: Hit[] = projects
          .filter((p: any) => {
            const blob = `${p.title} ${p.intent} ${p.creator?.handle}`.toLowerCase();
            return blob.includes(needle.replace(/^@/, ""));
          })
          .slice(0, 8)
          .map((p: any) => ({
            id: p.id,
            kind: "project" as const,
            title: p.title || "Project",
            subtitle: `@${p.creator?.handle || "builder"}${p.intent ? ` · ${String(p.intent).slice(0, 40)}` : ""}`,
            run: () => {
              useShellUi.getState().openProject(p.id);
              onClose();
            },
          }));

        const roomHits: Hit[] = projects
          .filter((p: any) => {
            const blob = `${p.title} ${p.creator?.handle}`.toLowerCase();
            return blob.includes(needle.replace(/^@/, ""));
          })
          .slice(0, 4)
          .map((p: any) => ({
            id: `room-${p.id}`,
            kind: "room" as const,
            title: `Join room · ${p.title}`,
            subtitle: "Open live table",
            run: () => {
              navigateToRoute({ kind: "room", id: p.id });
              onClose();
            },
          }));

        const handleMatch = needle.replace(/^@/, "");
        const profileHits: Hit[] =
          handleMatch.length >= 2
            ? [
                {
                  id: `u-${handleMatch}`,
                  kind: "profile",
                  title: `@${handleMatch}`,
                  subtitle: "Open profile",
                  run: () => {
                    navigateToRoute({ kind: "profile", handle: handleMatch });
                    onClose();
                  },
                },
              ]
            : [];

        const filters = staticHits.filter(
          (h) =>
            h.title.toLowerCase().includes(needle) ||
            (h.subtitle || "").toLowerCase().includes(needle)
        );

        setHits([...projectHits, ...roomHits, ...profileHits, ...filters].slice(0, 12));
        setActive(0);
      } catch {
        setHits(staticHits);
      } finally {
        setLoading(false);
      }
    },
    [onClose, staticHits]
  );

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits(staticHits);
    setActive(0);
  }, [open, staticHits]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void search(q), 180);
    return () => window.clearTimeout(t);
  }, [q, open, search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && hits[active]) {
        e.preventDefault();
        hits[active].run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hits, active, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#12151a] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3">
          <span className="text-white/40 text-[14px]">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search canvases, goals, or builders…"
            className="w-full bg-transparent py-3.5 text-[14px] text-white outline-none placeholder:text-white/35"
          />
          <kbd className="hidden sm:inline rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/35">
            esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {loading && (
            <li className="px-4 py-3 text-[12px] text-white/40">Searching…</li>
          )}
          {!loading && hits.length === 0 && (
            <li className="px-4 py-3 text-[12px] text-white/40">No matches</li>
          )}
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => h.run()}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${
                  i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="mt-0.5 w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  {h.kind}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-white">{h.title}</span>
                  {h.subtitle && (
                    <span className="block text-[11px] text-white/45 truncate">{h.subtitle}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
