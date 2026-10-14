"use client";
import {motion, useSpring, useReducedMotion} from "framer-motion";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Tiny board tilt near edges only — no nav hooks. */
export default function PeekFrame({
  enabled,
  onMap,
  onWar,
  children,
}: {
  enabled: boolean;
  onMap: () => void;
  onWar: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const sp = {stiffness: 180, damping: 28, mass: 0.45};
  const ry = useSpring(0, sp);
  const sx = useSpring(0, sp);
  void onMap;
  void onWar;

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== "mouse" || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const Z = Math.min(100, r.width * 0.1);
    const l = clamp(1 - x / Z);
    const rr = clamp(1 - (r.width - x) / Z);
    // very subtle
    ry.set((rr - l) * 1.2);
    sx.set((l - rr) * 2.5);
  };
  const rest = () => {
    ry.set(0);
    sx.set(0);
  };

  return (
    <div className="absolute inset-0" onPointerMove={move} onPointerLeave={rest}>
      <motion.div
        className={enabled ? "absolute overflow-hidden will-change-transform" : "absolute inset-0"}
        style={
          enabled
            ? {
                left: 6,
                right: 6,
                top: 6,
                bottom: 6,
                borderRadius: 14,
                rotateY: ry,
                x: sx,
                transformPerspective: 1600,
                boxShadow: "0 0 0 1px #242936,0 16px 48px rgba(0,0,0,.5)",
              }
            : undefined
        }
      >
        {children}
      </motion.div>
    </div>
  );
}
