import {create} from "zustand";

type S = {
  vaultHandle: string | null;
  launchOpen: boolean;
  openVault: (handle: string) => void;
  closeVault: () => void;
  openLaunch: () => void;
  closeLaunch: () => void;
};
export const useShellUi = create<S>((set) => ({
  vaultHandle: null,
  launchOpen: false,
  openVault: (handle) => set({vaultHandle: handle}),
  closeVault: () => set({vaultHandle: null}),
  openLaunch: () => set({launchOpen: true}),
  closeLaunch: () => set({launchOpen: false}),
}));
