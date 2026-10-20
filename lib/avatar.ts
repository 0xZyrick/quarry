/**
 * Neutral brand avatar palette — initials fallback when no photo is set.
 */
export type GenderAvatar = "male" | "female" | null | undefined;

const PALETTES = [
  ["#2a2d34", "#4a5568"],
  ["#1e293b", "#334155"],
  ["#292524", "#44403c"],
  ["#1f2937", "#374151"],
  ["#27272a", "#3f3f46"],
  ["#1c1917", "#44403c"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarColors(handle: string, _gender?: GenderAvatar) {
  const h = hash(handle || "?");
  const [bg, accent] = PALETTES[h % PALETTES.length];
  return { bg, accent };
}

export function avatarStyle(handle: string, gender?: GenderAvatar): Record<string, string> {
  const { bg, accent } = avatarColors(handle, gender);
  return { background: `linear-gradient(145deg, ${bg}, ${accent})` };
}

/** @deprecated glyph faces removed — Avatar uses initials or photo */
export function avatarGlyph(_gender?: GenderAvatar): string {
  return "";
}
