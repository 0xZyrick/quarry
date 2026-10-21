"use client";
/**
 * Spatial shell — feed (0) + room (2) only.
 * Community / map layer and side-swipe-into-map removed.
 */
import InboxSheet from "../inbox/InboxSheet";
import {motion, animate, useMotionValue} from "framer-motion";
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {useGuild, Layer} from "@/lib/store";
import WarRoom from "../war/WarRoom";
import FeedLayer from "./FeedLayer";
import {readLink, writeLink} from "@/lib/deeplink";
import {reducedMotion} from "@/lib/perf";
import {useRoomSecurity} from "@/lib/store";
import {viewsFor} from "@/lib/access";
import {useRoomCtl} from "@/lib/roomCtl";
import {useHubs, isVisible} from "@/lib/hubs";
import {useStats} from "@/lib/stats";
import Workspace from "../stream/Workspace";
import ModBanner from "../safety/ModBanner";
import CreateEntrance from "../create/CreateEntrance";
import VaultSheet from "../vault/VaultSheet";
import {useShellUi} from "@/lib/shellUi";
import {useOnboarding} from "@/features/onboarding/OnboardingProvider";
import ProjectWorkspace from "../project/ProjectWorkspace";
import {navigateToRoute, routeFromPath} from "@/lib/appRoutes";
import LoadingWorld from "../shared/LoadingWorld";
import CommandPalette from "./CommandPalette";

const SPRING = {type: "spring" as const, stiffness: 420, damping: 36};
type G = {
  id: number;
  x: number;
  y: number;
  axis: "" | "x" | "y";
  l: Layer;
  lastX: number;
  lastT: number;
  vx: number;
};

/** Only feed (0) and room (2). Map/community layer removed. */
function clampLayer(n: number): Layer {
  if (n <= 0) return 0;
  return 2;
}

export default function SpatialShell() {
  const launchOpen = useShellUi((s) => s.launchOpen);
  const routeProjectId = useShellUi((s) => s.routeProjectId);
  const activeTab = useShellUi((s) => s.activeTab);
  const {data: account, signedIn, clearAuth, update} = useOnboarding();
  const {layer, setLayer, load, room, setRoom, roomId, trans} = useGuild();
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [liveMenuOpen, setLiveMenuOpen] = useState(false);
  const [studioCode, setStudioCode] = useState("");
  const [studioCodeError, setStudioCodeError] = useState("");
  const [studioCodeBusy, setStudioCodeBusy] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [liveClock, setLiveClock] = useState("00:00");
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [size, setSize] = useState({w: 390});
  const [viewportReady, setViewportReady] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const sz = useRef(size);
  sz.current = size;

  // sx slides between the feed and room.
  const sx = useMotionValue(0);
  const roomScale = useMotionValue(1);

  const gs = useRef<G | null>(null);
  const routeInitialized = useRef(false);
  const routeLoadingTimer = useRef<number | null>(null);
  const sec = useRoomSecurity();
  const profileReady = useGuild((s) => s.profileReady);
  const studioUnlocked = useGuild((s) => !!s.profile?.studioUnlocked);
  const gr = useHubs((s) => !!s.greenroom[roomId]);
  const views = viewsFor(sec.room.type, gr);

  // Live session clock only for true live streams (not VOD / log reels)
  useEffect(() => {
    const onLive = (e: Event) => {
      const detail = (e as CustomEvent).detail as { live?: boolean } | boolean | undefined;
      const live = typeof detail === "boolean" ? detail : !!detail?.live;
      setIsLiveSession(live);
      if (live) setSessionStartedAt((prev) => prev ?? Date.now());
      else {
        setSessionStartedAt(null);
        setLiveMenuOpen(false);
      }
    };
    window.addEventListener("wippo:live-session", onLive as EventListener);
    return () => window.removeEventListener("wippo:live-session", onLive as EventListener);
  }, []);

  useEffect(() => {
    if (layer !== 2) {
      setIsLiveSession(false);
      setSessionStartedAt(null);
      setLiveMenuOpen(false);
      window.dispatchEvent(new CustomEvent("wippo:live-session", { detail: { live: false } }));
    }
  }, [layer, roomId]);

  useEffect(() => {
    if (sessionStartedAt == null) {
      setLiveClock("00:00");
      return;
    }
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      setLiveClock(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  // Cmd/Ctrl+K command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const run = useCallback((l: Layer, inst: boolean) => {
    const w = sz.current.w;
    const tx = l === 2 ? -w : 0;
    const rm = reducedMotion();
    sx.stop();
    if (inst || rm) sx.set(tx);
    else animate(sx, tx, SPRING);

    if (l !== 0) {
      // entering room
      if (inst && !rm) {
        roomScale.set(1.04);
        animate(roomScale, 1, {duration: 0.28, ease: [0.2, 0.7, 0.2, 1]});
      }
    }
  }, []);

  useEffect(() => {
    const inst = useGuild.getState().instant;
    if (inst) useGuild.setState({instant: false});
    // Migrate any leftover layer-1 state to feed
    if (layer === 1) {
      setLayer(0);
      return;
    }
    run(layer, inst);
  }, [layer]);

  useEffect(() => {
    if (!routeInitialized.current) return;
    if (routeProjectId || useShellUi.getState().vaultHandle) return;
    const route = layer === 2
      ? {kind: "room" as const, id: roomId}
      : activeTab === "explore"
        ? {kind: "discover" as const}
        : {kind: "studio" as const};
    const path = routeFromPath(window.location.pathname);
    if (JSON.stringify(path) !== JSON.stringify(route)) {
      navigateToRoute(route, true);
    }
  }, [layer, roomId, routeProjectId, activeTab]);

  useLayoutEffect(() => {
    const measure = () => {
      setSize({w: window.innerWidth});
      setViewportReady(true);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [size.w, layer]);

  useEffect(() => {
    sx.stop();
    sx.set(layer === 2 ? -size.w : 0);
  }, [size.w, layer]);

  useEffect(() => {
    const applyRoute = () => {
      const firstRoute = !routeInitialized.current;
      if (routeLoadingTimer.current !== null) window.clearTimeout(routeLoadingTimer.current);

      let route = routeFromPath(window.location.pathname);
      if (window.location.pathname === "/" && route.kind !== "discover") {
        const legacyLink = readLink();
        if (legacyLink) route = {kind: "room", id: legacyLink.roomId};
      }
      const guild = useGuild.getState();
      // Only flash overlay on first paint or room/project entry — not Discover↔Studio tab flips
      const heavy =
        firstRoute ||
        route.kind === "room" ||
        route.kind === "project" ||
        route.kind === "profile";
      if (heavy) {
        setRouteLoading(true);
        setRouteReady(false);
      }
      routeInitialized.current = true;
      if (route.kind === "studio" || route.kind === "discover") {
        useShellUi.setState({
          routeProjectId: null,
          vaultHandle: null,
          activeTab: route.kind === "discover" ? "explore" : "circles",
        });
        if (guild.layer !== 0) {
          useGuild.setState({instant: true});
          guild.setLayer(0);
        }
      } else if (route.kind === "room") {
        useShellUi.setState({routeProjectId: null, vaultHandle: null});
        guild.setRoomId(route.id);
        guild.setRoom("stream");
        useGuild.setState({instant: true});
        guild.setLayer(2);
      } else if (route.kind === "project") {
        useShellUi.setState({routeProjectId: route.id, vaultHandle: null});
      } else {
        useShellUi.setState({routeProjectId: null, vaultHandle: route.handle});
      }

      requestAnimationFrame(() => {
        routeLoadingTimer.current = window.setTimeout(() => {
          setRouteReady(true);
          setRouteLoading(false);
        }, heavy ? (firstRoute ? 120 : 80) : 0);
      });
    };
    applyRoute();
    window.addEventListener("popstate", applyRoute);
    window.addEventListener("wippo:navigate", applyRoute);
    window.addEventListener("wippo:routechange", applyRoute);
    return () => {
      if (routeLoadingTimer.current !== null) window.clearTimeout(routeLoadingTimer.current);
      window.removeEventListener("popstate", applyRoute);
      window.removeEventListener("wippo:navigate", applyRoute);
      window.removeEventListener("wippo:routechange", applyRoute);
    };
  }, []);

  useEffect(() => {
    if (layer === 2 && !views.includes(room))
      setRoom(views[views.length > 1 && room === "commons" ? 1 : 0]);
  }, [layer, room, views.join()]);

  useEffect(() => {
    useRoomCtl.getState().reset();
  }, [roomId]);

  useEffect(() => {
    const f = () => useHubs.getState().sync();
    f();
    const t = setInterval(f, 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const u = useHubs.subscribe((s) => {
      const g = useGuild.getState();
      if (g.selected && !isVisible(g.selected, s)) g.select(null);
    });
    return u;
  }, []);

  useEffect(() => {
    const t = setInterval(() => useStats.getState().tick(), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (layer === 2) useStats.getState().visit(roomId);
  }, [layer, roomId]);

  useEffect(() => {
    if (useGuild.getState().dive) return;
    writeLink(layer === 2 ? {roomId, view: room} : null);
  }, [layer, room, roomId]);

  useEffect(() => {
    load();
  }, []);

  const go = (n: number) => {
    const t = clampLayer(n);
    if (t === layer) run(t, false);
    else setLayer(t);
  };

  const unlockStudio = async (event: React.FormEvent) => {
    event.preventDefault();
    setStudioCodeBusy(true);
    setStudioCodeError("");
    try {
      const response = await fetch("/api/studio/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: studioCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not unlock Studio.");
      useGuild.setState((state) => ({
        profile: state.profile ? { ...state.profile, studioUnlocked: true } : state.profile,
      }));
      setStudioCode("");
    } catch (error) {
      setStudioCodeError(error instanceof Error ? error.message : "Could not unlock Studio.");
    } finally {
      setStudioCodeBusy(false);
    }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (document.documentElement.hasAttribute("data-onboarding")) return;
      if (
        /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName) ||
        useGuild.getState().dive ||
        useGuild.getState().trans
      )
        return;
      // feed <-> room only
      if (e.key === "ArrowRight" && layer === 0) go(2);
      if (e.key === "ArrowLeft" && layer === 2) go(0);
      if (layer === 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const f = document.querySelector(".snap-y-feed");
        f?.scrollBy({
          top: (e.key === "ArrowDown" ? 1 : -1) * (f as HTMLElement).clientHeight,
          behavior: "smooth",
        });
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [layer]);

  // Horizontal swipe: feed → room (left), room → feed (right). No map.
  const down = (e: React.PointerEvent) => {
    if (gs.current) {
      gs.current = null;
      return;
    }
    if (useGuild.getState().dive || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (layer === 0)
      useGuild.setState({
        swipeNode:
          (e.target as HTMLElement).closest?.("[data-node]")?.getAttribute("data-node") ?? null,
      });
    gs.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      axis: "",
      l: layer,
      lastX: e.clientX,
      lastT: performance.now(),
      vx: 0,
    };
  };

  const move = (e: React.PointerEvent) => {
    const s = gs.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    if (!s.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gs.current = null;
        return;
      }
      s.axis = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
      sx.stop();
    }
    const now = performance.now(),
      dt = now - s.lastT;
    if (dt > 0) s.vx = 0.8 * s.vx + 0.2 * ((e.clientX - s.lastX) / dt);
    s.lastX = e.clientX;
    s.lastT = now;
    const w = sz.current.w;
    if (s.l === 0) {
      // drag left toward room
      sx.set(dx < 0 ? Math.max(-w, dx) : dx * 0.15);
    } else {
      // in room: drag right toward feed
      sx.set(-w + (dx > 0 ? Math.min(dx, w) : dx * 0.15));
    }
  };

  const up = (e: React.PointerEvent) => {
    const s = gs.current;
    gs.current = null;
    if (!s || s.axis !== "x") return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const w = sz.current.w,
      vx = s.vx,
      x = sx.get();
    let t: Layer = s.l === 1 ? 0 : s.l;
    if (s.l === 0) {
      if (x < -w * 0.25 || (vx < -0.5 && x < -20)) t = 2;
      else t = 0;
    } else {
      if (x > -w * 0.75 || vx > 0.5) t = 0;
      else t = 2;
    }
    go(t);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none bg-[var(--page)] flex flex-col"
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
        e.currentTarget.scrollTop = 0;
      }}
      onPointerDown={undefined}
      onPointerMove={undefined}
      onPointerUp={undefined}
      onPointerCancel={undefined}
    >
      {/* Top nav — logo + Discover/Studio (mobile: slim; desktop: full tools) */}
      <header className="shrink-0 z-40 w-full border-b border-white/[0.05] bg-[#0B0C0E]/95 backdrop-blur-xl">
        <div className="w-full h-12 sm:h-14 px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: logo */}
          <button
            type="button"
            onClick={() => {
              if (layer === 2) go(0);
              navigateToRoute({ kind: "discover" });
            }}
            className="shrink-0 flex items-center"
            aria-label="Wippo home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wippo-logo.png"
              alt="Wippo"
              className="h-7 sm:h-8 w-auto max-w-[7.5rem] sm:max-w-[11rem] object-contain object-left"
            />
          </button>

          {/* Center: Discover / Studio — always visible */}
          <nav
            className="flex items-center gap-0.5 p-0.5 rounded-full border border-white/[0.08] bg-[#111318]/90"
            aria-label="Primary"
          >
            {layer === 2 ? (
              <button
                type="button"
                onClick={() => go(0)}
                className="rounded-full px-3 py-1.5 text-[12px] text-white/60 hover:text-white"
              >
                ← Back
              </button>
            ) : (
              <>
                <TopTab
                  id="explore"
                  label="Discover"
                  onClick={() => navigateToRoute({ kind: "discover" })}
                />
                <TopTab
                  id="circles"
                  label="Studio"
                  onClick={() => navigateToRoute({ kind: "studio" })}
                />
              </>
            )}
          </nav>

          {/* Right: desktop search + live + account (mobile tools live in bottom nav) */}
          <div className="flex items-center gap-1.5 sm:gap-2 justify-end min-w-0">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex min-w-0 max-w-xs items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-left hover:bg-white/[0.05] transition"
            >
              <span className="text-white/35 text-[13px]">⌕</span>
              <span className="truncate text-[12px] text-white/40">
                Search…
              </span>
              <kbd className="ml-auto shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/30">
                ⌘K
              </kbd>
            </button>

            {layer === 2 && isLiveSession && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLiveMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full bg-[#10B981]/15 ring-1 ring-[#10B981]/40 px-2.5 py-1.5 text-[11px] font-semibold text-[#6ee7b7] hover:bg-[#10B981]/25"
                  aria-expanded={liveMenuOpen}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="hidden sm:inline">LIVE</span>
                  <span className="tabular-nums">{liveClock}</span>
                </button>
                {liveMenuOpen && (
                  <div className="absolute right-0 top-11 z-50 w-48 rounded-2xl border border-white/10 bg-[#12151a]/95 p-1.5 shadow-2xl backdrop-blur-xl">
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/80 hover:bg-white/[0.06]"
                      onClick={() => {
                        setLiveMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("wippo:room-mute"));
                      }}
                    >
                      Mute / unmute
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/80 hover:bg-white/[0.06]"
                      onClick={() => {
                        setLiveMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("wippo:room-canvas"));
                      }}
                    >
                      Change canvas
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[12px] text-red-300 hover:bg-white/[0.06]"
                      onClick={() => {
                        setLiveMenuOpen(false);
                        go(0);
                        navigateToRoute({ kind: "discover" });
                      }}
                    >
                      End session
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Desktop-only inbox + account; mobile uses bottom nav */}
            <button
              type="button"
              aria-label="Inbox"
              onClick={() => useShellUi.getState().openInbox()}
              className="hidden sm:grid rounded-full w-9 h-9 place-items-center border border-white/[0.07] text-white/55 hover:text-white hover:bg-white/5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16v12H4z" />
                <path d="m4 8 8 6 8-6" />
              </svg>
            </button>

            {signedIn ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] pl-1 pr-2 sm:pr-3 py-1 text-[11px] font-medium text-white hover:bg-white/[0.08]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--coral)]/20 text-[var(--coral)] font-bold">
                    {(account.name || "W").replace(/^@/, "").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden md:inline max-w-24 truncate">
                    @{(account.name || "").replace(/^@/, "")}
                  </span>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-white/10 bg-[#12151a]/95 p-2 shadow-2xl backdrop-blur-xl">
                    <p className="px-3 py-2 text-[12px] text-white/45">Signed in as</p>
                    <p className="px-3 pb-2 text-[14px] font-semibold text-white truncate">
                      @{(account.name || "").replace(/^@/, "")}
                    </p>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[14px] text-white/80 hover:bg-white/[0.06]"
                      onClick={() => {
                        setAccountOpen(false);
                        const handle = String(account.name || "")
                          .replace(/^@/, "")
                          .toLowerCase();
                        if (handle) navigateToRoute({ kind: "profile", handle });
                      }}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[14px] text-white/80 hover:bg-white/[0.06]"
                      onClick={() => {
                        setAccountOpen(false);
                        navigateToRoute({ kind: "studio" });
                      }}
                    >
                      Studio
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-[14px] text-red-300 hover:bg-white/[0.06]"
                      onClick={() => {
                        setAccountOpen(false);
                        clearAuth();
                      }}
                    >
                      Sign out
                    </button>
                    {accountError && (
                      <p role="alert" className="px-3 py-1 text-[12px] text-[var(--coral)]">
                        {accountError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("wippo:auth", { detail: "sign in" })
                  )
                }
                className="hidden sm:inline-flex rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.06]"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Content sits BELOW header — full remaining viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden pb-14 sm:pb-0">
      {/* Content: feed | room */}
      <motion.div className="flex h-full" style={{width: size.w * 2, x: sx}}>
        <section
          style={{width: size.w}}
          aria-label="Feed"
          {...({inert: layer === 2 ? "" : undefined} as any)}
          className="h-full relative"
        >
          <FeedLayer />
        </section>
        <motion.section
          style={{
            width: size.w,
            scale: roomScale,
            pointerEvents: trans && (trans.to === 2 || trans.from === 2) ? "none" : "auto",
          }}
          aria-busy={!!trans}
          aria-label="Room"
          {...({inert: layer !== 2 ? "" : undefined} as any)}
          className="h-full"
        >
          {room === "war" ? (
            <WarRoom />
          ) : (
            /* stream + commons share the project Live Room chrome */
            <Workspace />
          )}
        </motion.section>
      </motion.div>

      <ModBanner />
      </div>{/* end content below header */}

      {/* Mobile bottom nav — Home · Search · Messages · Profile */}
      {layer !== 2 && (
        <nav
          className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.08] bg-[#0B0C0E]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile primary"
        >
          <div className="grid grid-cols-4 h-14">
            <button
              type="button"
              onClick={() => {
                navigateToRoute({ kind: "discover" });
                useShellUi.getState().setActiveTab("explore");
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                activeTab === "explore" ? "text-[var(--cream)]" : "text-white/45"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
              </svg>
              Home
            </button>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-white/45"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Search
            </button>
            <button
              type="button"
              onClick={() => useShellUi.getState().openInbox()}
              className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-white/45"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16v12H4z" />
                <path d="m4 8 8 6 8-6" />
              </svg>
              Messages
            </button>
            <button
              type="button"
              onClick={() => {
                if (signedIn) {
                  const handle = String(account.name || "").replace(/^@/, "").toLowerCase();
                  if (handle) navigateToRoute({ kind: "profile", handle });
                  else useShellUi.getState().setActiveTab("profile");
                } else {
                  window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "sign in" }));
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                activeTab === "profile" ? "text-[var(--cream)]" : "text-white/45"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" />
              </svg>
              Profile
            </button>
          </div>
        </nav>
      )}
      {routeProjectId && (
        <div className="fixed inset-0 z-[55] bg-[var(--page)]">
          <ProjectWorkspace
            projectId={routeProjectId}
            onClose={() => useShellUi.getState().closeProject()}
          />
        </div>
      )}
      <CreateEntrance open={launchOpen} onClose={() => useShellUi.getState().closeLaunch()} />
      <VaultSheet />
      <InboxSheet />
      {(!viewportReady || !routeReady || routeLoading) && <LoadingWorld overlay />}
    </div>
  );
}


function TopTab({
  id,
  label,
  onClick,
}: {
  id: "circles" | "explore" | "profile";
  label: string;
  onClick: () => void;
}) {
  const active = useShellUi((s) => s.activeTab) === id;
  return (
    <button
      type="button"
      onClick={() => {
        useShellUi.getState().setActiveTab(id);
        onClick();
      }}
      className={`relative rounded-full px-2.5 sm:px-3.5 py-1.5 text-[12px] sm:text-[14px] font-medium transition-colors ${
        active ? "text-[var(--cream)] bg-white/10" : "text-[var(--text-muted)] hover:text-[var(--cream)]"
      }`}
    >
      {label}
    </button>
  );
}
