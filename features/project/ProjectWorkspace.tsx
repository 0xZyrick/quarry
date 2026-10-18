"use client";
/**
 * Project workspace entry — full journey page (serialized production log).
 */
import ProjectJourneyPage from "./ProjectJourneyPage";

export default function ProjectWorkspace({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
  focusContribute?: boolean;
  initialTab?: string;
}) {
  return <ProjectJourneyPage projectId={projectId} onClose={onClose} />;
}
