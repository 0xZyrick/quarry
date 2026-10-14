/** Real skill imagery + optional ambient loops for mosaic tiles.
 * Stills: fixed Unsplash IDs. Videos: small public CC0 samples (muted loops).
 */
export type SkillKey =
  | "coding" | "interior" | "graphics" | "3d" | "architecture"
  | "carpentry" | "mural" | "motion" | "branding" | "ui" | "default";

const U = (id: string, w = 640) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const SKILL_IMG: Record<SkillKey, string> = {
  coding:       U("photo-1461749280684-dccba630e2f6"),
  interior:     U("photo-1618221195710-dd6b41faaea6"),
  graphics:     U("photo-1561070791-2526d30994b5"),
  "3d":         U("photo-1633356122544-f134324a6cee"),
  architecture: U("photo-1487958449943-2429e8be8625"),
  carpentry:    U("photo-1504148455328-c376907d081c"),
  mural:        U("photo-1541961017774-22349e4a1262"),
  motion:       U("photo-1574717024653-61fd2cf4d44d"),
  branding:     U("photo-1558655146-d09347e92766"),
  ui:           U("photo-1559028012-481c04fa702d"),
  default:      U("photo-1497366216548-37526070297c"),
};

/** Ambient muted loops — only one tile plays at a time in the mosaic. */
const LOOPS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
];

export const ROLE_IMG = {
  creator: U("photo-1516321318423-f06f85e504b3", 960),
  client:  U("photo-1503387762-592deb58ef4e", 960),
};

export function skillKey(tag: string): SkillKey {
  const t = tag.toLowerCase();
  if (/rust|code|shader|dev|program|software|fullstack|backend|frontend/.test(t)) return "coding";
  if (/interior|furniture|space planning/.test(t)) return "interior";
  if (/graphic|illustration|brand/.test(t)) return "branding";
  if (/ui|ux|figma|product design/.test(t)) return "ui";
  if (/3d|cgi|render|blender|cinema/.test(t)) return "3d";
  if (/architec/.test(t)) return "architecture";
  if (/carpent|wood|joinery/.test(t)) return "carpentry";
  if (/mural|paint|street art/.test(t)) return "mural";
  if (/motion|animat|film|video/.test(t)) return "motion";
  if (/design/.test(t)) return "graphics";
  return "default";
}

export function imgForSkills(skills: string[]): string {
  if (!skills?.length) return SKILL_IMG.default;
  return SKILL_IMG[skillKey(skills[0])] ?? SKILL_IMG.default;
}

/** Deterministic loop URL from tile id so each card has a stable ambient clip. */
export function loopForTile(tileId: string): string {
  let h = 0;
  for (let i = 0; i < tileId.length; i++) h = (h * 31 + tileId.charCodeAt(i)) >>> 0;
  return LOOPS[h % LOOPS.length];
}

/** Head portraits for onboarding gender + profile avatars */
export const GENDER_AVATAR = {
  male:   "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&h=256&q=80",
  female: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80",
} as const;
export type Gender = keyof typeof GENDER_AVATAR;
