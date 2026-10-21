/**
 * Full mock world for the demo experiment.
 * Multiple creators, projects, journey stops, and video feed cards.
 */

export type DemoFeedCard = {
  id: string;
  title: string;
  projectTitle: string;
  stack: string;
  phaseLabel: string;
  target: string;
  status: "live" | "needs_hand" | "offline";
  people?: number;
  duration?: string;
  creatorHandle: string;
  imageUrl: string | null;
  mediaUrl: string;
  hasVideo: true;
  helpId?: string;
};

const V = {
  // User-supplied Pexels + Shutterstock previews (demo only)
  c1: "https://videos.pexels.com/video-files/6911828/6911828-hd_1920_1080_25fps.mp4",
  c2: "https://videos.pexels.com/video-files/7504609/7504609-uhd_4096_2160_25fps.mp4",
  c3: "https://videos.pexels.com/video-files/28320042/12359943_1920_1080_24fps.mp4",
  c4: "https://videos.pexels.com/video-files/9849532/9849532-uhd_4096_2160_25fps.mp4",
  c5: "https://videos.pexels.com/video-files/5896104/5896104-uhd_3840_2160_30fps.mp4",
  c6: "https://www.shutterstock.com/shutterstock/videos/4088339637/preview/stock-footage-maseru-lesotho-young-woman-entrepreneur-sews-leather-goods.webm",
  c7: "https://www.shutterstock.com/shutterstock/videos/3561626269/preview/stock-footage-african-woman-spinning-manual-wheel-of-sewing-machine-working-outdoors.webm",
  c8: "https://videos.pexels.com/video-files/6195405/6195405-uhd_3840_2160_25fps.mp4",
};

/** Discover feed — all video, multiple projects/creators */
export const DEMO_FEED: DemoFeedCard[] = [
  {
    id: "demo-proj-little-worlds",
    title: "Night palette pass",
    projectTitle: "Little Worlds",
    stack: "Three.js · GLSL",
    phaseLabel: "Alpha · Week 7",
    target: "Warm accent on the night sky without muddy mids",
    status: "live",
    people: 4,
    duration: "32m",
    creatorHandle: "mike",
    imageUrl: null,
    mediaUrl: V.c1,
    hasVideo: true,
  },
  {
    id: "demo-proj-cursor-engine",
    title: "Spring trail physics",
    projectTitle: "Cursor Engine",
    stack: "React · Motion",
    phaseLabel: "Prototype",
    target: "Pointer trails that feel weighty, not laggy",
    status: "needs_hand",
    people: 2,
    creatorHandle: "nia",
    imageUrl: null,
    mediaUrl: V.c2,
    hasVideo: true,
    helpId: "demo-help-1",
  },
  {
    id: "demo-proj-brand-lab",
    title: "Logo lockup v3",
    projectTitle: "Brand Lab",
    stack: "Figma",
    phaseLabel: "Idea",
    target: "Mark that still feels handmade at 16px",
    status: "offline",
    creatorHandle: "ccardo",
    imageUrl: null,
    mediaUrl: V.c3,
    hasVideo: true,
  },
  {
    id: "demo-proj-sound-shelf",
    title: "Room tone bed",
    projectTitle: "Sound Shelf",
    stack: "Ableton · WebAudio",
    phaseLabel: "Build",
    target: "Loopable room tone under live sessions",
    status: "live",
    people: 1,
    duration: "18m",
    creatorHandle: "ada",
    imageUrl: null,
    mediaUrl: V.c4,
    hasVideo: true,
  },
  {
    id: "demo-proj-paddle",
    title: "Paddle easing",
    projectTitle: "Table Physics",
    stack: "Canvas · Matter",
    phaseLabel: "Playtest",
    target: "Spring easing that reads as skill, not lag",
    status: "needs_hand",
    creatorHandle: "jo",
    imageUrl: null,
    mediaUrl: V.c5,
    hasVideo: true,
    helpId: "demo-help-2",
  },
  {
    id: "demo-proj-atlas",
    title: "Zone labels",
    projectTitle: "City Atlas",
    stack: "Mapbox · React",
    phaseLabel: "Alpha",
    target: "Readable labels at city zoom",
    status: "offline",
    creatorHandle: "kodo.dev",
    imageUrl: null,
    mediaUrl: V.c6,
    hasVideo: true,
  },
  {
    id: "demo-proj-crew-board",
    title: "Seat claim flow",
    projectTitle: "Crew Board",
    stack: "Next · Liveblocks",
    phaseLabel: "Week 3",
    target: "Claim a seat without breaking focus",
    status: "live",
    people: 6,
    duration: "1h 02m",
    creatorHandle: "mio.3d",
    imageUrl: null,
    mediaUrl: V.c7,
    hasVideo: true,
  },
  {
    id: "demo-proj-shader-farm",
    title: "Banding fix reel",
    projectTitle: "Shader Farm",
    stack: "GLSL",
    phaseLabel: "Log",
    target: "Document the dither pass that killed banding",
    status: "offline",
    creatorHandle: "ada",
    imageUrl: null,
    mediaUrl: V.c8,
    hasVideo: true,
  }

];

export function isDemoProjectId(id: string) {
  return id.startsWith("demo-") || id.startsWith("mock-");
}

export function demoJourneyProject(id: string) {
  const card = DEMO_FEED.find((c) => c.id === id) || DEMO_FEED[0];
  const title = card.projectTitle;
  const handle = card.creatorHandle;
  const drop = (url: string) => [{ videoUrl: url, imageUrl: card.imageUrl }];
  return {
    id: card.id,
    title,
    intentStatement: card.target,
    status: "IN_PROGRESS",
    creatorId: `u-${handle}`,
    createdAt: new Date(Date.now() - 21 * 864e5).toISOString(),
    creator: { handle, id: `u-${handle}` },
    coverImageUrl: card.imageUrl,
    currentState: card.phaseLabel,
    nextStep: card.target,
    _count: { followers: 40 + (title.length % 50) * 7, journeyNodes: 6 },
    journeyNodes: [
      {
        id: `${card.id}-n1`,
        position: 1,
        dayLabel: "Week 1",
        phaseTitle: "Spark",
        summaryText: `Started ${title} with one clear mechanic, not a full product.`,
        updateKind: "MILESTONE",
        mediaUrl: card.mediaUrl,
        hasVideo: true,
        mediaDrops: drop(card.mediaUrl),
      },
      {
        id: `${card.id}-n2`,
        position: 2,
        dayLabel: "Week 2",
        phaseTitle: "First playable",
        summaryText: "Something on screen that other people could react to.",
        updateKind: "MILESTONE",
        mediaUrl: V.c5,
        hasVideo: true,
        mediaDrops: drop(V.c1),
      },
      {
        id: `${card.id}-n3`,
        position: 3,
        dayLabel: "Week 3",
        phaseTitle: "Wrong direction",
        summaryText: "Tried the obvious path. It looked fine alone and failed in context.",
        updateKind: "DEAD_END",
        isSetback: true,
        mediaUrl: V.c6,
        hasVideo: true,
        mediaDrops: drop(V.c2),
      },
      {
        id: `${card.id}-n4`,
        position: 4,
        dayLabel: "Week 4",
        phaseTitle: "Ask the room",
        summaryText: "Put the decision in front of other builders instead of guessing.",
        updateKind: "DECISION",
        mediaUrl: V.c7,
        hasVideo: true,
        mediaDrops: drop(V.c3),
        discussions: [
          {
            id: "d1",
            handle: "nia",
            timeLabel: "0:12",
            messageText: "The simpler path reads better on mobile.",
          },
          {
            id: "d2",
            handle: "ada",
            timeLabel: "0:28",
            messageText: "I'd ship the rough version and iterate live.",
          },
        ],
      },
      {
        id: `${card.id}-n5`,
        position: 5,
        dayLabel: "Week 5",
        phaseTitle: "Help lands",
        summaryText: "Someone jumped in and unblocked the stuck piece.",
        updateKind: "MILESTONE",
        mediaUrl: V.c8,
        hasVideo: true,
        mediaDrops: drop(V.c4),
      },
      {
        id: `${card.id}-n6`,
        position: 6,
        dayLabel: card.phaseLabel || "Week 6",
        phaseTitle: card.title,
        summaryText: card.target,
        updateKind: "MILESTONE",
        mediaUrl: card.mediaUrl,
        hasVideo: true,
        mediaDrops: drop(card.mediaUrl),
        evolutionDelta: "Dead end shared · Decision opened · Help claimed · Log shipped",
        tools: card.stack ? card.stack.split("·").map((s) => s.trim()) : ["Figma"],
      },
    ],
  };
}

export function demoProfileView(handle: string, isSelf: boolean) {
  const h = handle.replace(/^@/, "") || "demo.builder";
  const own = DEMO_FEED.filter(
    (c) => c.creatorHandle === h || (isSelf && c.creatorHandle === "demo.builder")
  );
  const journeys = (own.length ? own : DEMO_FEED.slice(0, 4)).map((c) => ({
    id: c.id,
    title: c.projectTitle,
    phase: c.phaseLabel,
    blurb: c.target,
    latest: c.title,
    openDecision: c.status === "needs_hand",
    following: 80 + c.projectTitle.length * 3,
    cover: null as string | null,
    mediaUrl: c.mediaUrl,
  }));

  return {
    handle: h,
    displayName: h === "demo.builder" ? "Demo Builder" : h,
    avatarUrl: null as string | null,
    roleLine: "Designer-engineer · open studio",
    bio: "Building in public. Multiple journeys in motion — logs, live rooms, and asks for help.",
    openToCollab: true,
    journeyCount: journeys.length,
    recordLine: `${journeys.length} active journeys. Dead ends shared. Help given and received.`,
    activityWeeks: [true, true, true, true, true, true, false, true, true, true, true, true],
    thinking: journeys.slice(0, 4).map((j, i) => ({
      id: `think-${i}`,
      kind: (i === 1 ? "Dead end" : i === 2 ? "Decision" : "Milestone") as
        | "Milestone"
        | "Dead end"
        | "Decision",
      project: j.title,
      week: `Week ${i + 1}`,
      title: j.latest,
      body: j.blurb,
    })),
    skills: ["Three.js", "GLSL", "Figma", "Next.js", "Live sessions"],
    vouch: {
      quote: "Showed up, explained the fix, left the room better than they found it.",
      by: "ada",
      context: "on Cursor Engine",
    },
    helped: [
      { who: "ada", what: "Banding fix on Shader Farm" },
      { who: "jo", what: "Spring easing on Table Physics" },
      { who: "nia", what: "Seat claim copy on Crew Board" },
    ],
    journeys,
    isSelf,
    studioUnlocked: true,
  };
}

/** Studio list when demo is on */
export const DEMO_STUDIO_PROJECTS = DEMO_FEED.filter(
  (c) => c.creatorHandle === "demo.builder" || c.creatorHandle === "mike"
).map((c) => ({
  id: c.id,
  title: c.projectTitle,
  status: "IN_PROGRESS",
  intentStatement: c.target,
  coverImageUrl: null as string | null,
  updatedAt: new Date().toISOString(),
  latestNode: {
    updateTitle: c.title,
    phaseTitle: c.phaseLabel,
    mediaUrl: c.mediaUrl,
    hasVideo: true,
  },
}));
