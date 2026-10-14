/**
 * Experience C onboarding — explore first, account when it matters.
 *
 * Flow:
 *  01 Welcome → Explore Quarry
 *  02 Browse mosaic as guest (no registration)
 *  03 Open project/creator freely
 *  04 Account only on Follow / Participate / Publish
 *  05 After signup: Discover work | Share my work (reversible)
 */
export type Track = "creator" | "client" | null;
export type PathChoice = "discover" | "share" | null;

export type Onboarding = {
  uid: string | null;
  name: string | null;
  auth: "invite" | "guest" | null;
  /** Guest has dismissed welcome and is browsing */
  explored: boolean;
  track: Track;
  pathChoice: PathChoice;
  gender: "male" | "female" | null;
  tags: string[];
  zone: string | null;
};

export const EMPTY: Onboarding = {
  uid: null,
  name: null,
  auth: null,
  explored: false,
  track: null,
  pathChoice: null,
  gender: null,
  tags: [],
  zone: null,
};

/** Signed-in account (can follow / publish) */
export const isSignedIn = (o: Onboarding) =>
  !!(o.uid && o.name && (o.auth === "invite" || o.auth === "guest"));

/**
 * App is usable when:
 * - guest explored (welcome done), OR
 * - fully signed in
 * Long form (gender, tags, zone) is optional / progressive — not required to enter.
 */
export const isComplete = (o: Onboarding) => o.explored || isSignedIn(o);

/** Needs auth modal when trying gated actions */
export const needsAuth = (o: Onboarding) => !isSignedIn(o);

const KEY = "guild.onboarding.v3";

export const onboardingAdapter = {
  read(): Onboarding {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!r) {
        // migrate soft from v2 if present
        const v2 = JSON.parse(localStorage.getItem("guild.onboarding.v2") || "null");
        if (v2?.uid && v2?.name) {
          return {
            uid: v2.uid,
            name: v2.name,
            auth: "invite",
            explored: true,
            track: v2.track === "creator" || v2.track === "client" ? v2.track : null,
            pathChoice: v2.track === "creator" ? "share" : "discover",
            gender: v2.gender === "male" || v2.gender === "female" ? v2.gender : null,
            tags: Array.isArray(v2.tags) ? v2.tags : [],
            zone: typeof v2.zone === "string" ? v2.zone : null,
          };
        }
        return EMPTY;
      }
      return {
        uid: typeof r.uid === "string" ? r.uid : null,
        name: typeof r.name === "string" ? r.name : null,
        auth: r.auth === "invite" || r.auth === "guest" ? r.auth : null,
        explored: !!r.explored || !!(r.uid && r.name),
        track: r.track === "creator" || r.track === "client" ? r.track : null,
        pathChoice: r.pathChoice === "discover" || r.pathChoice === "share" ? r.pathChoice : null,
        gender: r.gender === "male" || r.gender === "female" ? r.gender : null,
        tags: Array.isArray(r.tags) ? r.tags : [],
        zone: typeof r.zone === "string" ? r.zone : null,
      };
    } catch {
      return EMPTY;
    }
  },
  write(o: Onboarding) {
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem("guild.onboarding.v2");
    } catch {}
  },
};

// ---- Tags / zones kept for progressive creator profile ----
export type Zone = { id: string; name: string; city: string };
export const ZONES: Zone[] = [
  { id: "lekki1", name: "Lekki Phase 1 Craft Zone", city: "Lagos" },
  { id: "ikeja", name: "Ikeja Craft Zone", city: "Lagos" },
  { id: "yaba", name: "Yaba Craft Zone", city: "Lagos" },
  { id: "vi", name: "VI Craft Zone", city: "Lagos" },
  { id: "kreuzberg", name: "Kreuzberg Craft Zone", city: "Berlin" },
  { id: "westlands", name: "Westlands Craft Zone", city: "Nairobi" },
  { id: "shoreditch", name: "Shoreditch Craft Zone", city: "London" },
  { id: "bandra", name: "Bandra Craft Zone", city: "Mumbai" },
  { id: "bk", name: "Brooklyn Craft Zone", city: "New York" },
  { id: "pinheiros", name: "Pinheiros Craft Zone", city: "São Paulo" },
  { id: "shibuya", name: "Shibuya Craft Zone", city: "Tokyo" },
  { id: "soma", name: "SoMa Craft Zone", city: "San Francisco" },
  { id: "surry", name: "Surry Hills Craft Zone", city: "Sydney" },
];

export const CREATOR_TAGS = [
  "code",
  "design",
  "3d",
  "game",
  "hardware",
  "film",
  "sound",
  "writing",
];
export const CLIENT_TAGS = ["startup", "agency", "studio", "solo", "enterprise"];
export const tagsFor = (t: Track) => (t === "creator" ? CREATOR_TAGS : t === "client" ? CLIENT_TAGS : []);

export const nodeName = (zoneId: string | null) => {
  const z = ZONES.find((x) => x.id === zoneId);
  return z ? z.name.replace(/ Craft Zone$/, "").replace(/ Phase 1$/, "") + " Node" : "Global";
};
export const zoneCity = (zoneId: string | null) => ZONES.find((z) => z.id === zoneId)?.city ?? null;
export const ZONE_GEO: Record<string, [number, number]> = {
  lekki1: [6.44, 3.47],
  ikeja: [6.6, 3.35],
  yaba: [6.51, 3.37],
  vi: [6.43, 3.42],
  kreuzberg: [52.5, 13.4],
  westlands: [-1.27, 36.81],
  shoreditch: [51.52, -0.08],
  bandra: [19.06, 72.83],
  bk: [40.68, -73.94],
  pinheiros: [-23.56, -46.69],
  shibuya: [35.66, 139.7],
  soma: [37.78, -122.4],
  surry: [-33.88, 151.21],
};
const rad = (d: number) => (d * Math.PI) / 180;
export function nearestZone(lat: number, lng: number) {
  let best = ZONES[0].id,
    bd = 1e9;
  for (const z of ZONES) {
    const [a, b] = ZONE_GEO[z.id];
    const d = Math.acos(
      Math.min(
        1,
        Math.sin(rad(lat)) * Math.sin(rad(a)) +
          Math.cos(rad(lat)) * Math.cos(rad(a)) * Math.cos(rad(lng - b))
      )
    );
    if (d < bd) {
      bd = d;
      best = z.id;
    }
  }
  return best;
}
export const locateZone = () =>
  new Promise<string>((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => res(nearestZone(p.coords.latitude, p.coords.longitude)),
      rej,
      { maximumAge: 6e5, timeout: 9000, enableHighAccuracy: false }
    );
  });
