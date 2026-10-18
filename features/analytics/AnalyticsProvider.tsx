"use client";
import { useEffect } from "react";
import { initAnalytics, identify, Funnel, analyticsEnabled } from "@/lib/analytics";
import { useOnboarding } from "../onboarding/OnboardingProvider";

/**
 * Boots PostHog once. Identifies when signed in.
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data, signedIn, ready } = useOnboarding();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initAnalytics();
      if (cancelled) return;
      if (analyticsEnabled()) {
        Funnel.arrive({ path: location.pathname });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (signedIn && data.uid) {
      identify(data.uid, {
        handle: data.name || undefined,
        track: data.track || undefined,
        gender: data.gender || undefined,
      });
    }
  }, [ready, signedIn, data.uid, data.name, data.track, data.gender]);

  return <>{children}</>;
}
