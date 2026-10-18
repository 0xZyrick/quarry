"use client";
/**
 * Profile sheet entry — full creator profile when vault is open.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useShellUi } from "@/lib/shellUi";
import CreatorProfile from "./CreatorProfile";

export default function VaultSheet() {
  const handle = useShellUi((s) => s.vaultHandle);
  const open = !!handle;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <CreatorProfile handle={handle} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
