"use client";
import { avatarColors, avatarGlyph, type GenderAvatar } from "@/lib/avatar";

export default function Avatar({
  handle,
  gender,
  size = 36,
  className = "",
}: {
  handle?: string | null;
  gender?: GenderAvatar;
  size?: number;
  className?: string;
}) {
  const h = handle || "?";
  const { bg, accent } = avatarColors(h, gender);
  return (
    <span
      className={`inline-grid place-items-center rounded-full shrink-0 text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(145deg, ${bg}, ${accent})`,
        boxShadow: "inset 0 -2px 6px rgba(0,0,0,0.25)",
      }}
      aria-hidden
    >
      {/* Soft face mark */}
      <span className="relative" style={{ lineHeight: 1 }}>
        <span className="opacity-90">{avatarGlyph(gender)}</span>
      </span>
    </span>
  );
}
