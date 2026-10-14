"use client";
import type {Gender} from "@/lib/skillMedia";

/** Simple stylized character head — not a photo. Male = blue top, female = pink top, neutral skin. */
export default function Avatar({
  gender,
  handle,
  size = 36,
  className = "",
}: {
  gender?: Gender | null;
  handle?: string;
  size?: number;
  className?: string;
}) {
  const g: Gender = gender === "female" ? "female" : "male";
  // Neutral mid skin tone
  const skin = "#C4A484";
  const skinShadow = "#A8896A";
  const shirt = g === "male" ? "#3B6FA0" : "#C47A9E";
  const shirtDark = g === "male" ? "#2A5280" : "#A35F82";
  const hair = g === "male" ? "#2C2416" : "#3D2B1F";
  const uid = `a-${(handle || g).replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`rounded-full shrink-0 border border-line ${className}`}
      aria-hidden
      role="img"
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        {/* bg */}
        <circle cx="32" cy="32" r="32" fill="#1a1d24" />
        {/* shoulders / shirt */}
        <ellipse cx="32" cy="58" rx="22" ry="14" fill={shirt} />
        <ellipse cx="32" cy="60" rx="18" ry="10" fill={shirtDark} opacity="0.5" />
        {/* neck */}
        <rect x="27" y="38" width="10" height="10" rx="3" fill={skinShadow} />
        {/* head */}
        <ellipse cx="32" cy="28" rx="14" ry="16" fill={skin} />
        {/* simple hair */}
        {g === "male" ? (
          <>
            <path d="M18 24c2-10 10-14 14-14s12 4 14 14c-3-6-8-8-14-8s-11 2-14 8z" fill={hair} />
            <path d="M18 22c1 4 2 6 3 7h-2c-1-2-1-5-1-7z" fill={hair} />
            <path d="M46 22c-1 4-2 6-3 7h2c1-2 1-5 1-7z" fill={hair} />
          </>
        ) : (
          <>
            <path d="M16 26c2-12 12-16 16-16s14 4 16 16c0 8-2 18-4 22h-6c1-6 2-14 2-18 0-6-4-10-8-10s-8 4-8 10c0 4 1 12 2 18h-6c-2-4-4-14-4-22z" fill={hair} />
            <path d="M20 20c4-6 10-8 12-8 3 0 6 1 8 4-6-2-12-1-16 2-2 1-3 2-4 2z" fill={hair} />
          </>
        )}
        {/* eyes */}
        <circle cx="26" cy="28" r="1.6" fill="#2a2218" />
        <circle cx="38" cy="28" r="1.6" fill="#2a2218" />
        {/* subtle nose */}
        <path d="M32 30v4" stroke={skinShadow} strokeWidth="1.2" strokeLinecap="round" />
        {/* mouth */}
        <path d="M28 36c2 2 6 2 8 0" stroke={skinShadow} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
