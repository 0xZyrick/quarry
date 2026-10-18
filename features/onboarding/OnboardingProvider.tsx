"use client";
import { AnimatePresence } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import OnboardingFlow from "./OnboardingFlow";
import AuthModal from "./AuthModal";

type Api = {
  data: Onboarding;
  ready: boolean;
  complete: boolean;
  /** App chrome is usable (explored guest or signed in) */
  active: boolean;
  signedIn: boolean;
  update: (p: Partial<Onboarding>) => void;
  requireAuth: (reason: string) => void;
  clearAuth: () => Promise<void>;
};

const Ctx = createContext<Api | null>(null);

export function useOnboarding() {
  const c = useContext(Ctx);
  if (!c) throw new Error("OnboardingProvider missing");
  return c;
}

/**
 * Welcome → look around (guest) or Explore (sign in).
 * requireAuth opens branded AuthModal (Drop in, Profile, etc.).
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Onboarding>(EMPTY);
  const [ready, setReady] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");

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
    setData(onboardingAdapter.read());
    setReady(true);
  }, []);

  const update = useCallback((p: Partial<Onboarding>) => {
    setData((d) => {
      const n = { ...d, ...p };
      onboardingAdapter.write(n);
      return n;
    });
  }, []);

  const clearAuth = useCallback(async () => {
    const response = await fetch("/api/session", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    onboardingAdapter.clear();
    setData({ ...EMPTY });
    useGuild.setState({ profile: null, profileReady: true });
  }, []);

  const requireAuth = useCallback((reason: string) => {
    setAuthReason(reason || "continue");
    setAuthOpen(true);
  }, []);

  const signedIn = isSignedIn(data);
  const complete = isComplete(data);
  const active = ready && (bypass || canUseApp(data));
  const showWelcome = ready && !bypass && !canUseApp(data);

  // Resolve the server-derived room roles after sign-in; do not invent a client-side role.
  useEffect(() => {
    if (!ready) return;
    if (signedIn && data.uid && data.name) {
      profileAdapter.get().then((profile) => {
        useGuild.setState({ profile, profileReady: true });
      }).catch(() => {
        useGuild.setState({ profile: null, profileReady: true });
      });
    } else {
      useGuild.setState({ profile: null, profileReady: true });
    }
  }, [ready, signedIn, data.uid, data.name, data.track]);

  useEffect(() => {
    const onAuth = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      requireAuth(typeof detail === "string" ? detail : "continue");
    };
    window.addEventListener("wippo:auth", onAuth);
    return () => window.removeEventListener("wippo:auth", onAuth);
  }, [requireAuth]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-onboarding", showWelcome);
  }, [showWelcome]);

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

      {/* First visit / incomplete profile — unified flow */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[60]">
            <OnboardingFlow
              key="onboarding"
              onFinished={() => {
                /* explored/signed flags written inside flow */
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Drop in / Profile gate */}
      <AuthModal
        open={authOpen}
        reason={authReason}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
      />
    </Ctx.Provider>
  );
}
