"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EMPTY,
  Onboarding,
  canUseApp,
  isComplete,
  isSignedIn,
  onboardingAdapter,
} from "@/lib/onboarding";
import { useGuild } from "@/lib/store";
import { profileAdapter } from "@/lib/profile";
import AuthModal from "./AuthModal";

type Api = {
  data: Onboarding;
  ready: boolean;
  complete: boolean;
  active: boolean;
  signedIn: boolean;
  update: (p: Partial<Onboarding>) => void;
  requireAuth: (reason: string, onContinue?: () => void) => void;
  clearAuth: () => Promise<void>;
};

const Ctx = createContext<Api | null>(null);

export function useOnboarding() {
  const c = useContext(Ctx);
  if (!c) throw new Error("OnboardingProvider missing");
  return c;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Onboarding>(EMPTY);
  const [ready, setReady] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [landingAuth, setLandingAuth] = useState(false);
  const dataRef = useRef(data);
  const pendingAuthAction = useRef<(() => void) | null>(null);
  dataRef.current = data;

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("onboarding") === "reset") {
      onboardingAdapter.clear();
      q.delete("onboarding");
      history.replaceState(
        null,
        "",
        location.pathname + (q.size ? `?${q}` : "") + location.hash
      );
    }
    setBypass(q.has("as") && process.env.NODE_ENV !== "production");
    const stored = onboardingAdapter.read();
    dataRef.current = stored;
    setData(stored);
    setReady(true);
  }, []);

  const update = useCallback((p: Partial<Onboarding>) => {
    const next = { ...dataRef.current, ...p };
    dataRef.current = next;
    onboardingAdapter.write(next);
    setData(next);
  }, []);

  const clearAuth = useCallback(async () => {
    const response = await fetch("/api/session", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    onboardingAdapter.clear();
    dataRef.current = { ...EMPTY };
    setData({ ...EMPTY });
    useGuild.setState({ profile: null, profileReady: true });
    setLandingAuth(true);
    setAuthOpen(true);
    setAuthReason("Create your account");
  }, []);

  const requireAuth = useCallback((reason: string, onContinue?: () => void) => {
    setLandingAuth(false);
    setAuthReason(reason || "continue");
    pendingAuthAction.current = onContinue ?? null;
    setAuthOpen(true);
  }, []);

  const signedIn = isSignedIn(data);
  const complete = isComplete(data);
  // App is usable once signed in (or guest explored / dev bypass)
  const active = ready && (bypass || signedIn || !!data.explored);

  // Landing gate: show auth as the first screen until signed in (or guest explored)
  useEffect(() => {
    if (!ready || bypass) return;
    if (!signedIn && !data.explored) {
      setLandingAuth(true);
      setAuthReason("Create your account");
      setAuthOpen(true);
    } else if (signedIn) {
      setLandingAuth(false);
      setAuthOpen(false);
    }
  }, [ready, bypass, signedIn, data.explored]);

  useEffect(() => {
    if (!ready) return;
    if (signedIn && data.uid && data.name) {
      profileAdapter
        .get()
        .then((profile) => {
          useGuild.setState({ profile, profileReady: true });
        })
        .catch(() => {
          useGuild.setState({ profile: null, profileReady: true });
        });
    } else {
      useGuild.setState({ profile: null, profileReady: true });
    }
  }, [ready, signedIn, data.uid, data.name, data.track]);

  useEffect(() => {
    const onAuth = (event: Event) => {
      const detail = (
        event as CustomEvent<string | { reason?: string; onContinue?: () => void }>
      ).detail;
      if (typeof detail === "string") requireAuth(detail);
      else requireAuth(detail?.reason || "continue", detail?.onContinue);
    };
    window.addEventListener("wippo:auth", onAuth);
    return () => window.removeEventListener("wippo:auth", onAuth);
  }, [requireAuth]);

  useEffect(() => {
    document.documentElement.removeAttribute("data-onboarding");
  }, []);

  const api = useMemo<Api>(
    () => ({
      data,
      ready,
      complete,
      active,
      signedIn,
      update,
      requireAuth,
      clearAuth,
    }),
    [data, ready, complete, active, signedIn, update, requireAuth, clearAuth]
  );

  return (
    <Ctx.Provider value={api}>
      {children}

      <AuthModal
        open={authOpen}
        reason={authReason}
        landing={landingAuth}
        onClose={() => {
          // Landing gate only closes via success (sign-in or guest explore)
          if (landingAuth && !dataRef.current.explored && !isSignedIn(dataRef.current)) return;
          pendingAuthAction.current = null;
          setLandingAuth(false);
          setAuthOpen(false);
        }}
        onSuccess={() => {
          setLandingAuth(false);
          setAuthOpen(false);
          const action = pendingAuthAction.current;
          pendingAuthAction.current = null;
          action?.();
        }}
      />
    </Ctx.Provider>
  );
}
