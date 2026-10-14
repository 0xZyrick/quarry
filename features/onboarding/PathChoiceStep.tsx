"use client";
/** STEP 05 — After signup: discover or share (reversible, not permanent account type). */
import { useOnboarding } from "./OnboardingProvider";
import { useShellUi } from "@/lib/shellUi";

export default function PathChoiceStep({ onDone }: { onDone?: () => void }) {
  const { update } = useOnboarding();
  const openLaunch = () => useShellUi.getState().openLaunch?.();

  const pick = (path: "discover" | "share") => {
    update({
      pathChoice: path,
      track: path === "share" ? "creator" : "client",
    });
    if (path === "share") {
      try {
        openLaunch();
      } catch {}
    }
    onDone?.();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-white">What did you come to do?</h2>
        <p className="mt-1 text-[12px] text-neutral-500">
          You can switch anytime — this is a starting point, not a permanent role.
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => pick("discover")}
            className="w-full text-left rounded-xl border border-white/8 hover:border-live/40 p-4 transition-colors"
          >
            <p className="text-sm font-medium text-white">Explore work</p>
            <p className="text-[12px] text-neutral-500 mt-1">
              Return to the mosaic, follow projects, see meaningful updates.
            </p>
          </button>
          <button
            type="button"
            onClick={() => pick("share")}
            className="w-full text-left rounded-xl border border-white/8 hover:border-live/40 p-4 transition-colors"
          >
            <p className="text-sm font-medium text-white">Share my work</p>
            <p className="text-[12px] text-neutral-500 mt-1">
              Start a project, work live, or share a quick discovery.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
