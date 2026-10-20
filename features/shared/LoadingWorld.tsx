"use client";

import { motion } from "framer-motion";

export default function LoadingWorld({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center overflow-hidden bg-[var(--page)] ${
        overlay ? "fixed inset-0 z-[100] backdrop-blur-md" : "min-h-[45vh] w-full"
      }`}
    >
      <motion.div
        initial={{ opacity: 0.25, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center gap-5"
      >
        <motion.div
          className="relative h-14 w-14 sm:h-16 sm:w-16"
          animate={{ opacity: [0.85, 1, 0.85], scale: [0.98, 1.02, 0.98] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wippo-icon.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </motion.div>
        <div className="text-center">
          <p className="text-[12px] font-medium tracking-[0.12em] text-[var(--text)] uppercase">
            Finding the work
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">Setting the table…</p>
        </div>
        <span className="sr-only">Loading your workspace</span>
      </motion.div>
    </div>
  );
}
