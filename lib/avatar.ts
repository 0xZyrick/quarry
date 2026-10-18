/**
 * Simple avatar system — no uploads required.
 * Uses gender + handle seed for consistent illustration-like faces.
 */
export type GenderAvatar = "male" | "female" | null | undefined;

const MALE_PALETTES = ["#3d5a80", "#ee6c4d", "#293241", "#98c1d9", "#e0fbfc"];
const FEMALE_PALETTES = ["#f4a261", "#e76f51", "#2a9d8f", "#e9c46a", "#264653"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarColors(handle: string, gender?: GenderAvatar) {
  const h = hash(handle || "?");
  const palette = gender === "female" ? FEMALE_PALETTES : MALE_PALETTES;
  const bg = palette[h % palette.length];
  const accent = palette[(h + 2) % palette.length];
  return { bg, accent };
}

/** CSS gradient for avatar circle */
export function avatarStyle(handle: string, gender?: GenderAvatar): Record<string, string> {
  const { bg, accent } = avatarColors(handle, gender);
  return {
    background: `linear-gradient(145deg, ${bg}, ${accent})`,
  };
}

/** Glyph inside avatar — not a raw letter dump; gender-aware figure mark */
export function avatarGlyph(gender?: GenderAvatar): string {
  if (gender === "female") return "♀";
  if (gender === "male") return "♂";
  return "✦";
}
