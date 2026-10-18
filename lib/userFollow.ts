import { currentUid } from "./circle";

export async function fetchUserFollowState(handle: string) {
  const viewerId = currentUid();
  const q = viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : "";
  const r = await fetch(`/api/users/${encodeURIComponent(handle)}/follow${q}`);
  if (!r.ok) return { following: false, followerCount: 0, followingCount: 0 };
  return r.json();
}

export async function toggleUserFollow(handle: string, currentlyFollowing: boolean) {
  const viewerId = currentUid();
  if (!viewerId) throw new Error("Sign in to follow people");
  const r = await fetch(`/api/users/${encodeURIComponent(handle)}/follow`, {
    method: currentlyFollowing ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewerId }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Follow failed");
  return d as { following: boolean; followerCount: number };
}
