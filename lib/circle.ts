/**
 * Circle = projects you follow.
 * Local-first so guests can build a circle; syncs to API when signed in.
 */
const KEY = "wippo.circle.v1";

export type CircleMap = Record<string, true>;

function readLocal(): CircleMap {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: CircleMap = {};
    for (const id of Object.keys(raw)) if (raw[id]) out[id] = true;
    return out;
  } catch {
    return {};
  }
}

function writeLocal(m: CircleMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

export function circleList(): string[] {
  return Object.keys(readLocal());
}

export function isInCircle(projectId: string): boolean {
  return !!readLocal()[projectId];
}

export function setInCircle(projectId: string, on: boolean): CircleMap {
  const m = readLocal();
  if (on) m[projectId] = true;
  else delete m[projectId];
  writeLocal(m);
  return m;
}

/** Current user id from onboarding local record (if any). */
export function currentUid(): string | null {
  try {
    const r = JSON.parse(localStorage.getItem("guild.onboarding.v3") || "null");
    return r && typeof r.uid === "string" && r.uid ? r.uid : null;
  } catch {
    return null;
  }
}

export type ToggleCircleResult = {
  inCircle: boolean;
  followerCount?: number;
};

/** Optimistic local update + API sync. Returns followerCount when signed in. */
export async function toggleCircle(
  projectId: string,
  currentlyIn: boolean
): Promise<boolean> {
  const next = !currentlyIn;
  setInCircle(projectId, next);
  const userId = currentUid();
  if (userId) {
    try {
      const r = await fetch("/api/follows", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });
      const d = await r.json().catch(() => ({}));
      if (typeof d.followerCount === "number") {
        (toggleCircle as any)._lastCount = d.followerCount;
      }
    } catch {
      /* keep local truth */
    }
  }
  try {
    const { Funnel } = await import("@/lib/analytics");
    Funnel.participate_circle({ projectId, on: next });
  } catch {}
  return next;
}

/** Same as toggleCircle but also returns server followerCount when available. */
export async function toggleCircleWithCount(
  projectId: string,
  currentlyIn: boolean
): Promise<ToggleCircleResult> {
  const next = !currentlyIn;
  setInCircle(projectId, next);
  const userId = currentUid();
  let followerCount: number | undefined;
  if (userId) {
    try {
      const r = await fetch("/api/follows", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });
      const d = await r.json().catch(() => ({}));
      if (typeof d.followerCount === "number") followerCount = d.followerCount;
    } catch {}
  }
  return { inCircle: next, followerCount };
}

/** Load circle ids: merge local + server follows when signed in. */
export async function loadCircleIds(): Promise<string[]> {
  const local = readLocal();
  const userId = currentUid();
  if (userId) {
    try {
      const r = await fetch(`/api/follows?userId=${encodeURIComponent(userId)}`);
      if (r.ok) {
        const d = await r.json();
        const items = d.follows || d.projects || d.items || [];
        for (const it of items) {
          const id = it.projectId || it.project?.id || it.id;
          if (id) local[id] = true;
        }
        writeLocal(local);
      }
    } catch {}
  }
  return Object.keys(local);
}

/** Full follows payload from server (for Circles stream). */
export async function loadFollowsFeed(): Promise<any[]> {
  const userId = currentUid();
  if (!userId) return [];
  try {
    const r = await fetch(`/api/follows?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.follows || [];
  } catch {
    return [];
  }
}
