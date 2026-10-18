/**
 * Project-level permissions (distinct from room access in lib/access.ts).
 * Same project feels different for owner vs collaborator vs guest.
 */
import { currentUid } from "./circle";

export type ProjectRole = "owner" | "collaborator" | "guest";

export type ProjectCaps = {
  /** Post a journey update */
  postUpdate: boolean;
  /** Edit title, intent, cover, status */
  editProject: boolean;
  /** Add/change milestones & status */
  manageMilestones: boolean;
  /** Invite / manage collaborators */
  managePeople: boolean;
  /** Visibility & who may contribute */
  manageSettings: boolean;
  /** Review & respond as host */
  moderateContributions: boolean;
  /** Archive or delete */
  destroy: boolean;
  /** Follow / unfollow (Circle) */
  follow: boolean;
  /** React on entries */
  react: boolean;
  /** Contribute (suggestion / critique / encouragement) */
  contribute: boolean;
  /** Request to collaborate */
  requestCollab: boolean;
  /** Share */
  share: boolean;
  /** Follow the creator profile */
  followCreator: boolean;
};

const OWNER: ProjectCaps = {
  postUpdate: true,
  editProject: true,
  manageMilestones: true,
  managePeople: true,
  manageSettings: true,
  moderateContributions: true,
  destroy: true,
  follow: false,
  react: true,
  contribute: true,
  requestCollab: false,
  share: true,
  followCreator: false,
};

const COLLAB: ProjectCaps = {
  postUpdate: true,
  editProject: false,
  manageMilestones: false,
  managePeople: false,
  manageSettings: false,
  moderateContributions: false,
  destroy: false,
  follow: true,
  react: true,
  contribute: true,
  requestCollab: false,
  share: true,
  followCreator: true,
};

const GUEST: ProjectCaps = {
  postUpdate: false,
  editProject: false,
  manageMilestones: false,
  managePeople: false,
  manageSettings: false,
  moderateContributions: false,
  destroy: false,
  follow: true,
  react: true,
  contribute: true,
  requestCollab: true,
  share: true,
  followCreator: true,
};

export function roleInProject(
  creatorId: string | null | undefined,
  collaboratorIds: string[] = [],
  uid: string | null = currentUid()
): ProjectRole {
  if (uid && creatorId && uid === creatorId) return "owner";
  if (uid && collaboratorIds.includes(uid)) return "collaborator";
  return "guest";
}

export function capsFor(role: ProjectRole): ProjectCaps {
  if (role === "owner") return OWNER;
  if (role === "collaborator") return COLLAB;
  return GUEST;
}

export function projectCaps(
  creatorId: string | null | undefined,
  collaboratorIds: string[] = [],
  uid?: string | null
): { role: ProjectRole; caps: ProjectCaps } {
  const role = roleInProject(creatorId, collaboratorIds, uid ?? currentUid());
  return { role, caps: capsFor(role) };
}
