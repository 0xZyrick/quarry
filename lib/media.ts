import {SKILL_IMG} from "./skillMedia";

export type Clip = {id: string; nodeId: string; name: string; skills: string[]; src: string; poster: string; hue: number};
export interface MediaAdapter { clips(): Promise<Clip[]> }

/** Lightweight silent sample for reels when LiveKit is off — real craft stills are the primary visual. */
export const BROADCAST_SRC = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const mockClipsAdapter: MediaAdapter = {
  async clips() {
    return [
      {id: "c0", nodeId: "n0", name: "mira.design", skills: ["Motion", "3D"], src: BROADCAST_SRC, poster: SKILL_IMG.motion, hue: 0},
      {id: "c1", nodeId: "n1", name: "kodo.dev", skills: ["Rust", "Shaders"], src: BROADCAST_SRC, poster: SKILL_IMG.coding, hue: 80},
      {id: "c2", nodeId: "n2", name: "ayo.ui", skills: ["UI/UX", "Figma"], src: BROADCAST_SRC, poster: SKILL_IMG.ui, hue: 200},
      {id: "c3", nodeId: "n3", name: "chidi.3d", skills: ["3D", "CGI"], src: BROADCAST_SRC, poster: SKILL_IMG["3d"], hue: 40},
      {id: "c4", nodeId: "n4", name: "sade.space", skills: ["Interior Design"], src: BROADCAST_SRC, poster: SKILL_IMG.interior, hue: 160},
      {id: "c5", nodeId: "n5", name: "tunde.codes", skills: ["Coding", "Architecture"], src: BROADCAST_SRC, poster: SKILL_IMG.coding, hue: 120},
    ];
  },
};
export const media: MediaAdapter = mockClipsAdapter;
