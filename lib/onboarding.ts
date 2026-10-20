/** Local onboarding record. Guest explore allowed; full actions need uid + name. */
import { ZONES } from "./map";

export type Gender = "male" | "female";
export type Track = "creator" | "client" | "guest";

export type Onboarding = {
  uid: string | null;
  name: string | null;
  auth: "invite" | "guest" | null;
  track: Track | null;
  gender: Gender | null;
  tags: string[];
  zone: string | null;
  bio?: string;
  /** User chose look around / left welcome */
  explored?: boolean;
};

export const EMPTY: Onboarding = {
  uid: null,
  name: null,
  auth: null,
  track: null,
  gender: null,
  tags: [],
  zone: null,
  explored: false,
};

/** Used by /api/hubs and TagStep */
/** Visual interest tiles for onboarding (maps → zones + feed) */
export const INTEREST_TILES = [
  { id: "games", label: "Games", sub: "Worlds, mechanics, prototypes", zone: "arcade" },
  { id: "digital_art", label: "Digital art", sub: "Illustration, 3D, visuals", zone: "atelier" },
  { id: "design", label: "Design", sub: "Products, graphics, interfaces", zone: "atelier" },
  { id: "music", label: "Music", sub: "Songs, sound, experiments", zone: "commons" },
  { id: "writing", label: "Writing", sub: "Stories, essays, ideas", zone: "commons" },
  { id: "physical", label: "Physical craft", sub: "Objects, fashion, making", zone: "shed" },
  { id: "film", label: "Film", sub: "Video, animation, cinema", zone: "bay" },
  { id: "technology", label: "Technology", sub: "Tools, code, inventions", zone: "forge" },
] as const;

export const CREATOR_TAGS = [
  "Coding",
  "Interior Design",
  "Mural Painting",
  "3D Motion",
  "Carpentry",
  "Branding UI",
  "Architecture",
] as const;

export const CLIENT_TAGS = [
  "Building a Team",
  "Hiring Local Crew",
  "Emergency Beacon Search",
  "Scouting Masterclasses",
] as const;

export const tagsFor = (t: Track | "creator" | "client") =>
  t === "client" ? [...CLIENT_TAGS] : [...CREATOR_TAGS];

/** Display name for a map / community zone id */
export const nodeName = (zoneId: string | null) => {
  if (!zoneId) return "Open Node";
  const z = ZONES.find((x) => x.id === zoneId);
  if (!z) return "Open Node";
  // "Lekki Phase 1 Craft Zone" / "The Forge" -> short label
  return z.name.replace(/\s+Craft Zone$/i, "").trim() || z.name;
};
/** City label for a zone id (used by mosaic local filter). */
export const zoneCity = (zoneId: string | null | undefined): string | null => {
  if (!zoneId) return null;
  const z = ZONES.find((x) => x.id === zoneId);
  return z?.city ?? null;
};


const KEY = "guild.onboarding.v3";

export function isSignedIn(o: Onboarding): boolean {
  return !!(o.uid && o.name && o.name.trim().length >= 2);
}

/** Enough to use the app (guest explore or signed in) */
export function canUseApp(o: Onboarding): boolean {
  return !!o.explored || isSignedIn(o);
}

/** Profile gate: signed in with track (guest track counts) */
export function isComplete(o: Onboarding): boolean {
  return isSignedIn(o) && (!!o.track || o.auth === "guest" || o.auth === "invite");
}

export function nextStep(o: Onboarding): number {
  if (!o.explored && !isSignedIn(o)) return -1;
  if (!isSignedIn(o)) return -1;
  if (!o.track) return 1;
  if (!o.gender) return 2;
  if (!o.tags.length) return 3;
  if (!o.zone) return 4;
  return 5;
}

export const onboardingAdapter = {
  read(): Onboarding {
    if (typeof window === "undefined" || !window.localStorage) return { ...EMPTY };
    try {
      const raw = window.localStorage.getItem(KEY);
      const r = JSON.parse(raw || "null");
      if (!r || typeof r !== "object") return { ...EMPTY };
      return {
        uid: typeof r.uid === "string" ? r.uid : null,
        name: typeof r.name === "string" ? r.name : null,
        auth: r.auth === "invite" || r.auth === "guest" ? r.auth : null,
        track:
          r.track === "creator" || r.track === "client" || r.track === "guest"
            ? r.track
            : null,
        gender: r.gender === "male" || r.gender === "female" ? r.gender : null,
        tags: Array.isArray(r.tags)
          ? r.tags.filter((x: unknown) => typeof x === "string")
          : [],
        zone: typeof r.zone === "string" ? r.zone : null,
        bio: typeof r.bio === "string" ? r.bio : undefined,
        explored: !!r.explored || !!(r.uid && r.name),
      };
    } catch {
      return { ...EMPTY };
    }
  },
  write(o: Onboarding) {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(o));
    } catch {}
  },
  clear() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
  },
};
