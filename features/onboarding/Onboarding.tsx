"use client";
import {AnimatePresence, motion} from "framer-motion";
import {nextStep} from "@/lib/onboarding";
import {useOnboarding} from "./OnboardingProvider";
import AuthStep from "./AuthStep";
import RoleStep from "./RoleStep";
import GenderStep from "./GenderStep";
import TagStep from "./TagStep";
import AnchorStep from "./AnchorStep";

export default function Onboarding() {
  const {data} = useOnboarding(),
    step = nextStep(data);
  const dots = [0, 1, 2, 3, 4];
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-deep"
      role="dialog"
      aria-modal="true"
      aria-label="Set up your account"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      transition={{duration: 0.5}}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{background: "radial-gradient(60% 50% at 50% 35%,rgba(0,163,255,.10),transparent 70%)"}}
      />
      <div
        className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={Math.min(5, step + 1)}
      >
        {dots.map((i) => (
          <i
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${i <= step ? "w-8 bg-live" : "w-4 bg-line"}`}
          />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="absolute inset-0"
          initial={{opacity: 0, y: 14}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: -14}}
          transition={{duration: 0.25}}
        >
          {step === 0 ? (
            <AuthStep />
          ) : step === 1 ? (
            <RoleStep />
          ) : step === 2 ? (
            <GenderStep />
          ) : step === 3 ? (
            <TagStep />
          ) : (
            <AnchorStep />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
