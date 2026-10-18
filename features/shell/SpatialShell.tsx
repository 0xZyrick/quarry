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

const SPRING = {type: "spring" as const, stiffness: 300, damping: 30};
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
  const gr = useHubs((s) => !!s.greenroom[roomId]);
  const views = viewsFor(sec.room.type, gr);

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
        roomScale.set(1.3);
        animate(roomScale, 1, {duration: 0.9, ease: [0.2, 0.7, 0.2, 1]});
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
      if (!firstRoute) {
        setRouteLoading(true);
        setRouteReady(false);
        if (routeLoadingTimer.current !== null) window.clearTimeout(routeLoadingTimer.current);
      } else {
        setRouteLoading(true);
        setRouteReady(false);
      }

      let route = routeFromPath(window.location.pathname);
      if (window.location.pathname === "/" && route.kind === "studio") {
        const legacyLink = readLink();
        if (legacyLink) route = {kind: "room", id: legacyLink.roomId};
      }
      const guild = useGuild.getState();
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
        }, firstRoute ? 220 : 260);
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
    const t = setInterval(f, 3000);
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
      {/* Top bar — fixed height in flow; content is always below */}
      <header className="shrink-0 z-40 w-full border-b border-white/[0.06] bg-[#090c12]/85 backdrop-blur-xl">
        <div className="w-full h-14 sm:h-16 px-2 sm:px-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
          {/* Left: logo only */}
          <div className="flex items-center min-w-0 justify-start">
            <button
              type="button"
              onClick={() => {
                navigateToRoute({kind: "studio"});
              }}
              className="shrink-0"
              aria-label="Wippo home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="relative block h-7 w-[4.5rem] sm:h-8 sm:w-[5.25rem] lg:h-9 lg:w-24">
                <img
                  src="/brand/wippo-logo.png"
                  alt="Wippo"
                  className="h-full w-full object-contain"
                />
              </span>
            </button>
          </div>

          {/* Center: Circle / Explore */}
          <div className="flex items-center justify-center">
            {layer === 0 ? (
              <nav className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full border border-white/[0.08] bg-[#111720]/80 shadow-[0_8px_32px_rgba(0,0,0,.2)]" aria-label="Primary">
                <TopTab
                  id="circles"
                  label="Studio"
                  onClick={() => navigateToRoute({kind: "studio"})}
                />
                <TopTab
                  id="explore"
                  label="Discover"
                  onClick={() => navigateToRoute({kind: "discover"})}
                />
              </nav>
            ) : (
              <button
                type="button"
                onClick={() => go(0)}
                className="rounded-full px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                ← Studio
              </button>
            )}
          </div>

          {/* Right: Create · Inbox · Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 justify-end min-w-0">
            {layer === 0 && signedIn && (
              <button
                type="button"
                onClick={() => useShellUi.getState().openLaunch()}
                aria-label="Start a project"
                className="rounded-full min-w-8 px-2 sm:px-3.5 py-2 text-[11px] font-semibold bg-[var(--coral)] text-white shadow-[0_0_24px_rgba(255,92,53,.2)] hover:brightness-110"
              >
                <span className="sm:hidden">+</span>
                <span className="hidden sm:inline">+ Start a project</span>
              </button>
            )}
            {layer === 2 && (
              <div className="flex text-[11px] font-medium p-0.5 rounded-full border border-[var(--line)] shrink-0">
                <span className="px-2.5 py-1 rounded-full bg-[var(--coral)] text-white">Workspace</span>
              </div>
            )}
            <button
              type="button"
              aria-label="Inbox"
              onClick={() => useShellUi.getState().openInbox()}
              className="rounded-full w-9 h-9 grid place-items-center border border-white/[0.07] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16v12H4z" />
                <path d="m4 8 8 6 8-6" />
              </svg>
            </button>
            {signedIn ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] pl-1 pr-3 py-1 text-[11px] font-medium text-[var(--text)] hover:bg-white/[0.08]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--coral)]/20 text-[var(--coral)] font-bold">
                    {(account.name || "W").replace(/^@/, "").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline max-w-24 truncate">@{account.name?.replace(/^@/, "")}</span>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-white/10 bg-[#111720]/95 p-2 shadow-2xl backdrop-blur-xl">
                    <p className="px-3 py-2 text-[11px] text-white/45">Signed in as</p>
                    <p className="px-3 pb-2 text-[13px] font-semibold text-white truncate">@{account.name?.replace(/^@/, "")}</p>
                    <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--growth)]">
                      {account.track === "client" ? "Project owner mode" : account.track === "creator" ? "Creator mode" : "Choose a work mode"}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextTrack = account.track === "client" ? "creator" : "client";
                        setAccountError("");
                        try {
                          const response = await fetch("/api/session", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ uid: account.uid, track: nextTrack }),
                          });
                          const result = await response.json().catch(() => ({}));
                          if (!response.ok) throw new Error(result.error || "Could not switch role.");
                          update({ track: nextTrack });
                        } catch (error) {
                          setAccountError(error instanceof Error ? error.message : "Could not switch role.");
                        }
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-[11px] text-white/65 hover:bg-white/[0.06] hover:text-white"
                    >
                      Switch to {account.track === "creator" ? "Project owner" : "Creator"} mode
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "link email sign-in" }));
                        setAccountOpen(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-[11px] text-white/65 hover:bg-white/[0.06] hover:text-white"
                    >
                      Add or change sign-in email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const handle = String(account.name || "").replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
                        useShellUi.getState().openVault(handle || "me");
                        setAccountOpen(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.06]"
                    >
                      Open your project archive
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountError("");
                        clearAuth().then(() => setAccountOpen(false)).catch((error) => {
                          setAccountError(error instanceof Error ? error.message : "Could not sign out.");
                        });
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-[12px] text-white/50 hover:bg-white/[0.06] hover:text-white"
                    >
                      Sign out
                    </button>
                    {accountError && <p role="alert" className="px-3 py-1 text-[10px] text-[var(--coral)]">{accountError}</p>}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "sign in" }))}
                className="rounded-full border border-white/10 px-3.5 py-2 text-[11px] font-semibold text-white/75 hover:border-white/20 hover:text-white"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Join / sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content sits BELOW header — full remaining viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
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

      {/* bottom nav removed — primary nav is top-left */}
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
      className={`relative rounded-full px-2 sm:px-3 py-1.5 text-[10px] sm:text-[12px] font-medium transition-colors ${
        active ? "text-[var(--cream)] bg-white/10" : "text-[var(--text-muted)] hover:text-[var(--cream)]"
      }`}
    >
      {label}
    </button>
  );
}
