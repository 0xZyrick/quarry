/**
 * Sample / explore world for guests.
 *
 * Guest  → sample feed, profile, rooms, journeys (explore how Wippo works).
 * Studio → never sample: requires sign-in + creator invite code.
 * Signed-in → real profile & studio; feed may pad with samples until > 8 real reels.
 */

const ONBOARDING_KEY = "guild.onboarding.v3";

export const DEMO_UID = "demo_user_wippo";
export const DEMO_HANDLE = "demo.builder";

function readOnboarding(): { auth?: string; track?: string; uid?: string; name?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

/** True when the visitor is exploring as guest. */
export function isGuestExplore(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const o = readOnboarding();
    if (!o) return false;
    return o.auth === "guest" || o.track === "guest";
  } catch {
    return false;
  }
}

/** Sample surfaces (feed / profile / journey / room) — guests only. Not Studio. */
export function isDemoMode(): boolean {
  return isGuestExplore();
}

export function enableDemoMode() {}
export function disableDemoMode() {}
export function seedDemoOnboarding() {}
