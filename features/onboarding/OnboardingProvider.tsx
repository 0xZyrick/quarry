"use client";
import { AnimatePresence } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EMPTY, Onboarding, isComplete, isSignedIn, onboardingAdapter } from "@/lib/onboarding";
import { profileAdapter, SessionLost } from "@/lib/profile";
import { useGuild } from "@/lib/store";
import Onboarding_ from "./Onboarding";
import AuthGate from "./AuthGate";
import PathChoiceStep from "./PathChoiceStep";

type Api = {
  data: Onboarding;
  ready: boolean;
  complete: boolean;
  active: boolean;
  signedIn: boolean;
  update: (p: Partial<Onboarding>) => void;
  /** Open auth when user tries Follow / Participate / Publish */
  requireAuth: (reason?: string) => void;
  dismissAuth: () => void;
  authOpen: boolean;
  authReason: string;
};

const Ctx = createContext<Api | null>(null);
export const useOnboarding = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("OnboardingProvider missing");
  return c;
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Onboarding>(EMPTY);
  const [ready, setReady] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("follow projects and participate");
  const [showPath, setShowPath] = useState(false);
  const [wasSignedIn, setWasSignedIn] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("onboarding") === "reset") {
      onboardingAdapter.clear();
      q.delete("onboarding");
      history.replaceState(null, "", location.pathname + (q.size ? "?" + q : "") + location.hash);
    }
    setBypass(q.has("as") && process.env.NODE_ENV !== "production");
    setData(onboardingAdapter.read());
    setReady(true);
  }, []);

  const update = useCallback((p: Partial<Onboarding>) => {
    setData((d) => {
      const n = { ...d, ...p };
      onboardingAdapter.write(n);
      // After first successful sign-in, offer path choice once
      if (p.uid && p.name && !d.uid) {
        setTimeout(() => setShowPath(true), 200);
      }
      return n;
    });
  }, []);

  const complete = isComplete(data);
  const signedIn = isSignedIn(data);
  const done = ready && (bypass || complete);

  useEffect(() => {
    if (!ready || bypass) return;
    let live = true;
    if (signedIn) {
      profileAdapter
        .get()
        .then((p) => {
          if (live) useGuild.setState({ profile: p, profileReady: true });
        })
        .catch((e) => {
          if (live && e instanceof SessionLost) {
            onboardingAdapter.clear();
            setData(EMPTY);
          }
        });
    } else {
      // Guest profile so UI doesn't crash
      useGuild.setState({
        profile: {
          id: "guest",
          handle: "guest",
          creatorNodeId: null,
          clientRoomIds: [],
          crewRoomIds: [],
        },
        profileReady: true,
      });
    }
    return () => {
      live = false;
    };
  }, [ready, bypass, signedIn, data.uid]);

  useEffect(() => {
    const on = ready && !done;
    document.documentElement.toggleAttribute("data-onboarding", on);
  }, [ready, done]);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (isSignedIn(data)) return;
      if (reason) setAuthReason(reason);
      setAuthOpen(true);
    },
    [data]
  );

  const api = useMemo(
    () => ({
      data,
      ready,
      complete,
      active: done,
      signedIn,
      update,
      requireAuth,
      dismissAuth: () => setAuthOpen(false),
      authOpen,
      authReason,
    }),
    [data, ready, complete, done, signedIn, update, requireAuth, authOpen, authReason]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <AnimatePresence>{ready && !done && <Onboarding_ key="welcome" />}</AnimatePresence>
      {authOpen && !signedIn && (
        <AuthGate
          reason={authReason}
          onClose={() => setAuthOpen(false)}
        />
      )}
      {showPath && signedIn && !data.pathChoice && (
        <PathChoiceStep onDone={() => setShowPath(false)} />
      )}
    </Ctx.Provider>
  );
}
