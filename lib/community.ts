/**
 * Community world — zones are places you belong to, not filters.
 * Identity · Proximity · Participation · Continuity
 */

export type ZoneId =
  | "forge"      // code / systems
  | "atelier"    // design / visual
  | "arcade"     // games
  | "commons"    // co-work / open tables
  | "bay"        // film / motion
  | "shed";      // hardware / physical

export type ZoneDef = {
  id: ZoneId;
  name: string;
  tagline: string;
  /** Why this place exists socially */
  identity: string;
  accent: string;
  /** Layout on the island (0–100 viewBox) */
  x: number;
  y: number;
  w: number;
  h: number;
  glyph: string;
};

export const ZONES: ZoneDef[] = [
  {
    id: "forge",
    name: "The Forge",
    tagline: "Systems, APIs, the hard problems",
    identity: "Builders who ship logic and infrastructure",
    accent: "#f06449",
    x: 8, y: 28, w: 28, h: 32,
    glyph: "⌘",
  },
  {
    id: "atelier",
    name: "Atelier",
    tagline: "Interfaces, illustration, craft of looking",
    identity: "People who care how things feel and look",
    accent: "#c4a574",
    x: 38, y: 12, w: 30, h: 28,
    glyph: "◇",
  },
  {
    id: "arcade",
    name: "Arcade",
    tagline: "Mechanics, playtests, loops",
    identity: "Game makers testing what clicks",
    accent: "#68866a",
    x: 68, y: 22, w: 26, h: 30,
    glyph: "▶",
  },
  {
    id: "commons",
    name: "Commons",
    tagline: "Open tables. Sit with someone working.",
    identity: "Co-working without a formal invite",
    accent: "#fff4de",
    x: 28, y: 48, w: 32, h: 28,
    glyph: "◎",
  },
  {
    id: "bay",
    name: "The Bay",
    tagline: "Motion, film, cuts that land",
    identity: "Story and frame people",
    accent: "#7a9eb5",
    x: 8, y: 62, w: 26, h: 28,
    glyph: "▣",
  },
  {
    id: "shed",
    name: "The Shed",
    tagline: "Hardware, tools, things you can hold",
    identity: "Makers of physical work",
    accent: "#b08968",
    x: 62, y: 58, w: 28, h: 28,
    glyph: "⬡",
  },
];

export function zoneById(id: string): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}

/** Mock continuity — later: live sessions + recent drops keyed by domain/zone */
export type ZonePulse = {
  zoneId: ZoneId;
  hereCount: number;
  liveCount: number;
  recentTitle?: string;
  recentHandle?: string;
};

export function defaultPulses(): ZonePulse[] {
  return ZONES.map((z, i) => ({
    zoneId: z.id,
    hereCount: [3, 5, 2, 8, 1, 2][i] ?? 1,
    liveCount: [1, 0, 1, 2, 0, 0][i] ?? 0,
    recentTitle: [
      "Auth edge cases",
      "Onboarding frames",
      "Intent-first duel loop",
      "Silent co-work hour",
      "Cut on the glance",
      "Desk lamp fixture",
    ][i],
    recentHandle: ["mira", "kodo", "ayo", "sade", "lena", "ravi"][i],
  }));
}
