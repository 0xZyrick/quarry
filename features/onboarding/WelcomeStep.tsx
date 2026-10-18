"use client";
import { motion } from "framer-motion";
import { useOnboarding } from "./OnboardingProvider";
import { useShellUi } from "@/lib/shellUi";

/**
 * Welcome — split-ish layout:
 * left/top: large brand mark + tagline
 * right/bottom: existing copy + Explore / look around
 *
 * Explore → sign-in if not logged in
 * look around → guest browse (restricted actions later)
 */
export default function WelcomeStep() {
  const { update, signedIn } = useOnboarding() as any;

  const goExplore = () => {
    if (signedIn) {
      update({ explored: true } as any);
      return;
    }
    // Need sign-in
    try {
      useShellUi.getState().openAuth?.();
    } catch {}
    update({ explored: false, authPending: true } as any);
  };

  const lookAround = () => {
    update({ explored: true, auth: "guest", name: "", uid: "" } as any);
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative lg:w-[42%] xl:w-[40%] min-h-[38vh] lg:min-h-0 lg:h-full flex flex-col items-center justify-center px-6 py-10 border-b lg:border-b-0 lg:border-r border-white/10">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(255,92,53,0.16), transparent 65%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wippo-logo.png"
            alt="Wippo"
            className="h-16 sm:h-20 lg:h-24 w-auto object-contain"
            draggable={false}
          />
          <p className="mt-4 text-[13px] sm:text-[14px] text-white/55 max-w-[14rem] leading-relaxed">
            A place to make, share progress, and find people who build.
          </p>
        </motion.div>
      </div>

      {/* Content panel */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(255,92,53,0.07), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-sm"
        >
          <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold text-white tracking-tight leading-tight">
            People are building out here
          </h1>
          <p className="mt-3 text-[14px] text-white/50 leading-relaxed">
            Follow work as it happens. Drop your own progress. Hang with the process.
          </p>

          <button
            type="button"
            onClick={goExplore}
            className="mt-8 w-full sm:w-auto min-w-[12rem] rounded-full px-8 py-3 text-[14px] font-semibold bg-[var(--coral)] text-white shadow-[0_0_32px_rgba(255,92,53,0.35)] hover:opacity-95"
          >
            Explore
          </button>

          <button
            type="button"
            onClick={lookAround}
            className="mt-4 block w-full text-[13px] text-white/40 hover:text-white/70 transition-colors"
          >
            or look around first
          </button>
        </motion.div>
      </div>
    </div>
  );
}
