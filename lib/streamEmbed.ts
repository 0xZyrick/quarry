/**
 * Parse Twitch / YouTube URLs into embeddable iframe src.
 * VOD resolve: optional API keys; otherwise returns null (paste vodUrl manually).
 */

export type StreamPlatform = "twitch" | "youtube" | "other";

export type ParsedStream = {
  platform: StreamPlatform;
  sourceUrl: string;
  embedUrl: string | null;
  channelOrId?: string;
  kind: "live" | "vod" | "unknown";
};

function parentHost(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return process.env.NEXT_PUBLIC_APP_HOST || "localhost";
}

function parseTwitch(url: URL): ParsedStream | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  if (parts[0] === "videos" && parts[1]) {
    return {
      platform: "twitch",
      sourceUrl: url.toString(),
      embedUrl: `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost()}&autoplay=false`,
      channelOrId: parts[1],
      kind: "vod",
    };
  }
  const channel = parts[0];
  if (["directory", "downloads", "jobs", "p"].includes(channel)) return null;
  return {
    platform: "twitch",
    sourceUrl: url.toString(),
    embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parentHost()}&muted=false`,
    channelOrId: channel,
    kind: "live",
  };
}

function parseYouTube(url: URL): ParsedStream | null {
  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;
  let kind: "live" | "vod" | "unknown" = "unknown";

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || null;
    kind = "vod";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname.startsWith("/watch")) {
      id = url.searchParams.get("v");
      kind = "vod";
    } else if (url.pathname.startsWith("/live/")) {
      id = url.pathname.split("/").filter(Boolean)[1] || null;
      kind = "live";
    } else if (url.pathname.startsWith("/embed/")) {
      id = url.pathname.split("/").filter(Boolean)[1] || null;
      kind = "vod";
    } else if (url.pathname.startsWith("/channel/") || url.pathname.startsWith("/@")) {
      return { platform: "youtube", sourceUrl: url.toString(), embedUrl: null, kind: "live" };
    }
  } else {
    return null;
  }

  if (!id) {
    return { platform: "youtube", sourceUrl: url.toString(), embedUrl: null, kind };
  }
  return {
    platform: "youtube",
    sourceUrl: url.toString(),
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=0&rel=0`,
    channelOrId: id,
    kind,
  };
}

export function parseStreamUrl(raw: string | null | undefined): ParsedStream | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  return (
    parseTwitch(url) ||
    parseYouTube(url) || {
      platform: "other",
      sourceUrl: url.toString(),
      embedUrl: null,
      kind: "unknown",
    }
  );
}

export function detectPlatform(raw: string): StreamPlatform {
  return parseStreamUrl(raw)?.platform ?? "other";
}

/**
 * Resolve archive URL after a live session.
 * Twitch: needs TWITCH_CLIENT_ID + TWITCH_APP_ACCESS_TOKEN
 * YouTube: needs YOUTUBE_API_KEY
 * Without keys → null (client may paste vodUrl).
 */
export async function resolveVodUrl(args: {
  platform: StreamPlatform;
  liveUrl: string;
  channelOrId?: string;
  sessionStartedAt?: Date;
}): Promise<string | null> {
  const parsed = parseStreamUrl(args.liveUrl);
  if (parsed?.kind === "vod" && parsed.sourceUrl) return parsed.sourceUrl;

  if (args.platform === "twitch" || parsed?.platform === "twitch") {
    return resolveTwitchVod(parsed?.channelOrId || args.channelOrId, args.sessionStartedAt);
  }
  if (args.platform === "youtube" || parsed?.platform === "youtube") {
    return resolveYouTubeVod(parsed?.channelOrId || args.channelOrId, args.sessionStartedAt);
  }
  return null;
}

async function resolveTwitchVod(
  channel: string | undefined,
  since?: Date
): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_APP_ACCESS_TOKEN;
  if (!clientId || !token || !channel) return null;

  try {
    // users → id
    const uRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
      { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` } }
    );
    if (!uRes.ok) return null;
    const uJson = await uRes.json();
    const userId = uJson.data?.[0]?.id;
    if (!userId) return null;

    const vRes = await fetch(
      `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=5`,
      { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` } }
    );
    if (!vRes.ok) return null;
    const vJson = await vRes.json();
    const videos = vJson.data || [];
    if (!videos.length) return null;

    // Prefer video created near session start
    let pick = videos[0];
    if (since) {
      const t0 = since.getTime();
      pick =
        videos.find((v: any) => {
          const c = new Date(v.created_at).getTime();
          return Math.abs(c - t0) < 6 * 3600e3;
        }) || videos[0];
    }
    return pick?.url || (pick?.id ? `https://www.twitch.tv/videos/${pick.id}` : null);
  } catch {
    return null;
  }
}

async function resolveYouTubeVod(
  videoOrChannel: string | undefined,
  _since?: Date
): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !videoOrChannel) return null;

  try {
    // If we already have a video id from /watch, the VOD is that id after stream ends
    if (/^[\w-]{11}$/.test(videoOrChannel)) {
      return `https://www.youtube.com/watch?v=${videoOrChannel}`;
    }
    // Channel search for completed live is heavier — skip without channel id mapping
    return null;
  } catch {
    return null;
  }
}
