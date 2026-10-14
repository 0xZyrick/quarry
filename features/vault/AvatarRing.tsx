"use client";
import {useEffect, useState} from "react";
import type {Gender} from "@/lib/skillMedia";
import {onboardingAdapter} from "@/lib/onboarding";
import Avatar from "../shared/Avatar";

export default function AvatarRing({handle, color, size = 136}: {handle: string; color: string; size?: number}) {
  const [gender, setGender] = useState<Gender | null>(null);
  useEffect(() => {
    try {
      const o = onboardingAdapter.read();
      if (o.name === handle && (o.gender === "male" || o.gender === "female")) setGender(o.gender);
    } catch {}
  }, [handle]);
  return (
    <div className="relative shrink-0" style={{width: size, height: size}}>
      <div className="absolute inset-0 rounded-full" style={{boxShadow: `0 0 0 2px ${color}55, 0 0 20px ${color}28`}} />
      <Avatar gender={gender} handle={handle} size={size} className="!border-0" />
    </div>
  );
}
