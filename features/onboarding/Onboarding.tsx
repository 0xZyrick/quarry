"use client";
/**
 * Only the welcome gate blocks the app.
 * Auth and path choice are modals triggered later (AuthGate / PathChoiceStep).
 */
import { motion } from "framer-motion";
import WelcomeStep from "./WelcomeStep";

export default function Onboarding() {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-deep"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Quarry"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(60% 50% at 50% 35%,rgba(0,163,255,.10),transparent 70%)",
        }}
      />
      <WelcomeStep />
    </motion.div>
  );
}
