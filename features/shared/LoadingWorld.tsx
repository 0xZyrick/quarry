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
        initial={{ opacity: 0.2, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative grid h-16 w-16 place-items-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-[1.35rem] border border-[var(--growth)]/25"
            animate={{ rotate: 180, scale: [0.9, 1.08, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute inset-2 rounded-full border-t-2 border-r-2 border-[var(--coral)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute inset-[10px] rounded-full bg-[var(--coral)]/10"
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-[17px] font-semibold tracking-[-0.08em] text-[var(--text)]">w.</span>
        </div>
        <div className="text-center">
          <p className="text-[12px] font-medium tracking-[0.12em] text-[var(--text)] uppercase">Finding the work</p>
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">Setting the table…</p>
        </div>
        <span className="sr-only">Loading your workspace</span>
      </motion.div>
    </div>
  );
}
