import { create } from "zustand";
import { navigateToRoute, returnFromRoute } from "./appRoutes";

export type MainTab = "circles" | "explore" | "profile" | null;

type S = {
  vaultHandle: string | null;
  launchOpen: boolean;
  authOpen: boolean;
  inboxOpen: boolean;
  /** Hide Circles/Explore/Drop in bar (journey, project, etc.) */
  hideMainNav: boolean;
  routeProjectId: string | null;
  activeTab: MainTab;
  openVault: (handle: string) => void;
  closeVault: () => void;
  openProject: (projectId: string) => void;
  closeProject: () => void;
  openLaunch: () => void;
  closeLaunch: () => void;
  openAuth: () => void;
  closeAuth: () => void;
  openInbox: () => void;
  closeInbox: () => void;
  setHideMainNav: (v: boolean) => void;
  setActiveTab: (t: MainTab) => void;
};

export const useShellUi = create<S>((set) => ({
  vaultHandle: null,
  launchOpen: false,
  authOpen: false,
  inboxOpen: false,
  hideMainNav: false,
  routeProjectId: null,
  activeTab: "explore",
  openVault: (handle) => {
    set({ vaultHandle: handle, routeProjectId: null });
    navigateToRoute({ kind: "profile", handle });
  },
  closeVault: () => {
    set({ vaultHandle: null });
    returnFromRoute();
  },
  openProject: (projectId) => {
    set({ routeProjectId: projectId, vaultHandle: null });
    navigateToRoute({ kind: "project", id: projectId });
  },
  closeProject: () => {
    set({ routeProjectId: null });
    returnFromRoute();
  },
  openLaunch: () => set({ launchOpen: true }),
  closeLaunch: () => set({ launchOpen: false }),
  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),
  openInbox: () => set({ inboxOpen: true }),
  closeInbox: () => set({ inboxOpen: false }),
  setHideMainNav: (v) => set({ hideMainNav: v }),
  setActiveTab: (t) => set({ activeTab: t }),
}));
