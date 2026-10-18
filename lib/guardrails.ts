/**
 * Light content guardrails for Drop in / updates.
 * Soft checks — not corporate moderation theater.
 */

export const CRAFT_DOMAINS = [
  { id: "code", label: "Code / Engineering" },
  { id: "design", label: "Design" },
  { id: "games", label: "Games" },
  { id: "3d", label: "3D" },
  { id: "hardware", label: "Hardware" },
  { id: "film", label: "Film" },
  { id: "other", label: "Other craft" },
] as const;

export type CraftDomainId = (typeof CRAFT_DOMAINS)[number]["id"];

const BLOCKLIST = [
  /\b(onlyfans|porn|xxx)\b/i,
  /\b(crypto.?giveaway|free.?nft)\b/i,
];

export function validateProgressDrop(input: {
  currentState?: string;
  summaryText?: string;
  domain?: string;
  acknowledgedPolicy?: boolean;
}): { ok: true; domain: CraftDomainId } | { ok: false; error: string } {
  const text = (input.currentState || input.summaryText || "").trim();

  if (text.length < 4) {
    return { ok: false, error: "Add a short note about what this shows." };
  }

  for (const re of BLOCKLIST) {
    if (re.test(text)) {
      return { ok: false, error: "This doesn’t fit Wippo — share real work in progress." };
    }
  }

  // Domain optional-ish: if provided must be known; if missing, allow "other"
  if (input.domain) {
    const known = CRAFT_DOMAINS.some((d) => d.id === input.domain);
    if (!known) {
      return { ok: false, error: "Pick a craft chip that fits." };
    }
  }

  return {
    ok: true,
    domain: (input.domain as CraftDomainId | undefined) ?? "other",
  };
}
// Add this line at the end of lib/guardrails.ts
export { validateProgressDrop as validateDrop };
