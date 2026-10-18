"use client";
/**
 * Feed surface — full-bleed discovery.
 * Map collapse / side-swipe-into-community removed; `pull` is ignored (always expanded).
 */
import {motion} from "framer-motion";
import Discovery from "../mosaic/Discovery";
import PeekFrame from "./PeekFrame";
import {useDesktop} from "@/lib/layout";

export default function FeedLayer() {
  const desktop = useDesktop();
  return (
    <motion.div className="absolute inset-0 z-10 bg-deep" style={{touchAction: "pan-y"}}>
      <PeekFrame enabled={desktop}>
        <Discovery />
      </PeekFrame>
    </motion.div>
  );
}
