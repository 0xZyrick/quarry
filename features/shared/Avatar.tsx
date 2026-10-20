"use client";
/**
 * Standard profile avatar — photo when set, otherwise initials on a neutral brand wash.
 * Changeable via avatarUrl on the profile (PATCH /api/profile).
 */
import { avatarColors } from "@/lib/avatar";

function initials(handle?: string | null) {
  const h = (handle || "?").replace(/^@/, "").trim();
  if (!h) return "?";
  const parts = h.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return h.slice(0, 2).toUpperCase();
}

export default function Avatar({
  handle,
  gender,
  size = 36,
  className = "",
  src,
}: {
  handle?: string | null;
  gender?: "male" | "female" | null;
  size?: number;
  className?: string;
  /** Optional photo URL — when present, replaces the glyph/initials mark */
  src?: string | null;
}) {
  const h = handle || "?";
  const { bg, accent } = avatarColors(h, gender);
  const label = initials(h);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`inline-grid place-items-center rounded-full shrink-0 text-white font-semibold select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.34),
        letterSpacing: "0.02em",
        background: `linear-gradient(145deg, ${bg}, ${accent})`,
        boxShadow: "inset 0 -1px 4px rgba(0,0,0,0.2)",
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}
