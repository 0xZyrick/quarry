/**
 * PostHog analytics
 *
 * Required in .env.local (restart `next dev` after changing):
 *   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_xxxxxxxx
 *   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
 *   (EU projects: https://eu.i.posthog.com)
 *
 * Install once: npm i posthog-js
 */

type Props = Record<string, string | number | boolean | null | undefined>;
type PostHog = typeof import("posthog-js").default;

let ready = false;
let posthog: PostHog | null = null;
let initPromise: Promise<void> | null = null;
const pendingEvents: Array<{ event: string; props?: Props }> = [];
const pendingIdentities: Array<{ userId: string; traits?: Props }> = [];

function flushQueue() {
  if (!posthog) return;
  for (const item of pendingEvents.splice(0)) {
    posthog.capture(item.event, item.props);
  }
  for (const item of pendingIdentities.splice(0)) {
    posthog.identify(item.userId, item.traits);
  }
}

function projectToken() {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  );
}

export function analyticsEnabled() {
  return typeof window !== "undefined" && !!projectToken();
}

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const key = projectToken();
    if (!key) {
      console.warn(
        "[analytics] Missing NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN. Add it to .env.local and restart next dev."
      );
      return;
    }

    const host = (
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    ).replace(/\/$/, "");

    try {
      const mod = await import("posthog-js");
      posthog = mod.default;

      // Avoid reinitializing PostHog if another bundle already initialized it.
      if (posthog.__loaded) {
        ready = true;
        flushQueue();
        return;
      }

      posthog.init(key, {
        api_host: host,
        ui_host: host.includes("eu.") ? "https://eu.posthog.com" : "https://us.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        autocapture: true,
        disable_session_recording: false,
        loaded: (ph) => {
          ready = true;
          flushQueue();
          console.info("[analytics] PostHog ready →", ph.config.api_host || host);
        },
      });
    } catch (e) {
      console.error("[analytics] PostHog initialization failed.", e);
      initPromise = null;
    }
  })();

  return initPromise;
}

export function track(event: string, props?: Props) {
  if (typeof window === "undefined") return;
  if (!ready || !posthog) {
    pendingEvents.push({ event, props });
    if (!initPromise) void initAnalytics();
    return;
  }
  try {
    posthog.capture(event, props);
  } catch (error) {
    console.error(`[analytics] Failed to capture "${event}".`, error);
  }
}

export function identify(userId: string, traits?: Props) {
  if (!userId) return;
  const run = () => {
    if (!posthog) return;
    try {
      posthog.identify(userId, traits);
    } catch (error) {
      console.error("[analytics] Failed to identify user.", error);
    }
  };
  if (ready && posthog) run();
  else {
    pendingIdentities.push({ userId, traits });
    if (!initPromise) void initAnalytics();
  }
}

export function resetAnalytics() {
  if (!ready || !posthog) return;
  try {
    posthog.reset();
  } catch (error) {
    console.error("[analytics] Failed to reset analytics identity.", error);
  }
}

/** Funnel stage helpers */
export const Funnel = {
  arrive: (props?: Props) => track("arrive_welcome", props),
  explore: (props?: Props) => track("explore_preview", props),
  join: (props?: Props) => track("join_account", props),
  personalize: (props?: Props) => track("personalize_interests", props),
  onboarding_complete: (props?: Props) => track("onboarding_complete", props),
  participate_follow: (props?: Props) => track("participate_follow", props),
  participate_circle: (props?: Props) => track("participate_circle", props),
  create_start: (props?: Props) => track("create_start", props),
  create_live: (props?: Props) => track("create_live", props),
  create_update: (props?: Props) => track("create_update", props),
  walk_in: (props?: Props) => track("walk_in_room", props),
};
