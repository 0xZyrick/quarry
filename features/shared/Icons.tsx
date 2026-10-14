/** Inline SVG icons — no emoji. 16×16 viewBox, currentColor. */
import {SVGProps} from "react";
type P = SVGProps<SVGSVGElement> & {size?: number};
const base = (d: string, size = 14) => function Icon(p: P) {
  const s = p.size ?? size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d={d} />
    </svg>
  );
};
// multi-path helpers
function Svg({size = 14, children, ...p}: P & {children: React.ReactNode}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Svg>
);
export const IconBolt = base("M13 2L3 14h8l-1 8 10-12h-8l1-8z");
export const IconMap = (p: P) => (
  <Svg {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></Svg>
);
export const IconMic = (p: P) => (
  <Svg {...p}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></Svg>
);
export const IconVideo = (p: P) => (
  <Svg {...p}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></Svg>
);
export const IconPlus = base("M12 5v14M5 12h14");
export const IconBrush = (p: P) => (
  <Svg {...p}><path d="M9.5 21a2.5 2.5 0 005 0V14H9.5v7z"/><path d="M14.5 14l5.1-5.1a2 2 0 000-2.8L16.9 3.4a2 2 0 00-2.8 0L9 8.5"/></Svg>
);
export const IconLeave = (p: P) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}><path d="M10.3 3.3L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.3a2 2 0 00-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Svg>
);
export const IconCoin = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/></Svg>
);
export const IconHand = (p: P) => (
  <Svg {...p}><path d="M18 11V6a2 2 0 00-4 0v1M14 7V4a2 2 0 00-4 0v4M10 8V5a2 2 0 00-4 0v9l-1.5-1.5a2 2 0 00-3 2.7L8 22h10a3 3 0 003-3v-6a2 2 0 00-2-2h-1"/></Svg>
);
export const IconSofa = (p: P) => (
  <Svg {...p}><path d="M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5"/><path d="M4 13a2 2 0 01-2-2V9a2 2 0 012-2h2v6H4zM20 13a2 2 0 002-2V9a2 2 0 00-2-2h-2v6h2z"/><path d="M8 7h8v6H8z"/></Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}><polyline points="15 18 9 12 15 6"/></Svg>
);
export const IconPin = (p: P) => (
  <Svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></Svg>
);
export const IconLive = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Svg>
);

/** Map control id → icon component for ControlBar */
export const CTL_ICON: Record<string, (p: P) => JSX.Element> = {
  stream: IconVideo, layout: IconSettings, crew: IconPlus, greenroom: IconSofa,
  voice: IconMic, draw: IconBrush, leave: IconLeave, release: IconLock,
  ptt: IconMic, dispute: IconAlert, tip: IconCoin, chat: IconChat, mic: IconHand,
};
