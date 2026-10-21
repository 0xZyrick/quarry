"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CirclesHome from "../circles/CirclesHome";
import ExploreHome from "../explore/ExploreHome";
import { useShellUi } from "@/lib/shellUi";

type View = "stories" | "circles";

/**
 * Discovery router.
 * Circles → operational catch-up (Milestone episodes).
 * Stories → explore / narrative mosaic.
 */
export default function Discovery() {
  const activeTab = useShellUi((state) => state.activeTab);
  const view: View = activeTab === "explore" ? "stories" : "circles";

  useEffect(() => {
    const onNav = (e: Event) => {
      const d = (e as CustomEvent).detail as string;
      if (d === "circles" || d === "network") {
        useShellUi.getState().setActiveTab("circles");
      } else if (d === "home" || d === "stories") {
        useShellUi.getState().setActiveTab("explore");
      }
    };
    window.addEventListener("wippo:nav", onNav);
    return () => window.removeEventListener("wippo:nav", onNav);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="h-full w-full overflow-hidden"
      >
        {view === "circles" ? <CirclesHome /> : <ExploreHome />}
      </motion.div>
    </AnimatePresence>
  );
}
