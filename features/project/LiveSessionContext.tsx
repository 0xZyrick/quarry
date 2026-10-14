"use client";
/**
 * Spectator: live session
 * Live work stays primary; surround with just enough context.
 * Private sessions never surface public Mosaic links.
 */
export default function LiveSessionContext({
  title,
  goal,
  currentState,
  nextStep,
  projectId,
  projectTitle,
  visibility,
  onOpenProject,
  onFollow,
  following,
}: {
  title?: string;
  goal?: string | null;
  currentState?: string | null;
  nextStep?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  visibility?: "PUBLIC" | "PRIVATE";
  onOpenProject?: () => void;
  onFollow?: () => void;
  following?: boolean;
}) {
  if (visibility === "PRIVATE") {
    return (
      <div className="px-3 py-2 border-b border-white/5 bg-black/40">
        <p className="text-[11px] font-mono text-neutral-500">Private session · not on public Mosaic</p>
        {title && <p className="text-sm text-white mt-0.5">{title}</p>}
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-white/5 bg-black/30 space-y-1.5">
      {title && <p className="text-sm font-medium text-white">{title}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-400">
        {goal && (
          <span>
            <span className="font-mono text-neutral-600 mr-1">Working on</span>
            {goal}
          </span>
        )}
        {currentState && (
          <span>
            <span className="font-mono text-neutral-600 mr-1">Now</span>
            {currentState}
          </span>
        )}
        {nextStep && (
          <span>
            <span className="font-mono text-neutral-600 mr-1">Next</span>
            {nextStep}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 pt-0.5">
        {projectId && onOpenProject && (
          <button type="button" onClick={onOpenProject} className="btn glass rounded-full px-2.5 py-0.5 font-mono text-[10px] text-live">
            {projectTitle ? `Project: ${projectTitle}` : "Open project"}
          </button>
        )}
        {onFollow && (
          <button type="button" onClick={onFollow} className="btn glass rounded-full px-2.5 py-0.5 font-mono text-[10px] text-neutral-300">
            {following ? "Following" : "Follow · return later"}
          </button>
        )}
      </div>
    </div>
  );
}
