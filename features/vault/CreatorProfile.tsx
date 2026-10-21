"use client";
/**
 * Creator profile — living resume from the work, not a static bio dump.
 * Header · Record · Activity · How they think · Skill tree · Active journeys
 */
import { useEffect, useState } from "react";
import { useShellUi } from "@/lib/shellUi";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { currentUid } from "@/lib/circle";
import { toggleUserFollow } from "@/lib/userFollow";
import Avatar from "../shared/Avatar";

type ThinkingItem = {
  id: string;
  kind: "Milestone" | "Dead end" | "Decision";
  project: string;
  week: string;
  title: string;
  body: string;
};

type JourneyCard = {
  id: string;
  title: string;
  phase: string;
  blurb: string;
  latest: string;
  openDecision?: boolean;
  following: number;
  cover?: string | null;
};

type ProfileView = {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  roleLine: string;
  bio: string;
  openToCollab: boolean;
  journeyCount: number;
  recordLine: string;
  activityWeeks: boolean[]; // 12 weeks
  thinking: ThinkingItem[];
  skills: string[];
  vouch: { quote: string; by: string; context: string } | null;
  helped: { who: string; what: string }[];
  journeys: JourneyCard[];
  isSelf: boolean;
};

function demoProfile(handle: string, isSelf: boolean): ProfileView {
  const h = handle.replace(/^@/, "") || "mike";
  return {
    handle: h,
    displayName: h,
    roleLine: "Designer-engineer",
    bio: "Designer and engineer making small worlds that notice you.",
    openToCollab: true,
    journeyCount: 1,
    recordLine:
      "7 stops over 7 weeks. 1 dead end shared openly, 2 decisions put to the community, and help given to 2 other builders.",
    activityWeeks: [true, true, true, true, true, false, false, true, true, true, true, true],
    thinking: [
      {
        id: "t1",
        kind: "Milestone",
        project: "Little Worlds",
        week: "Week 1",
        title: "The idea: a world that notices you",
        body: "Started with one mechanic, not a whole world — presence that reacts to whoever is looking.",
      },
      {
        id: "t2",
        kind: "Dead end",
        project: "Little Worlds",
        week: "Week 2",
        title: "Image textures felt flat",
        body: "Tried photographed clouds. They looked pasted on and killed the mood.",
      },
      {
        id: "t3",
        kind: "Decision",
        project: "Little Worlds",
        week: "Week 5",
        title: "Clouds: soft or sharp?",
        body: "Both looked fine alone. Asked the community instead of picking in private.",
      },
    ],
    skills: ["GLSL", "Three.js", "Figma", "Claude"],
    vouch: {
      quote: "Explained the cloud fix in ten minutes, and why it worked.",
      by: "ada",
      context: "on Little Worlds, Week 5",
    },
    helped: [
      { who: "ada", what: "Found the cause of banding in her sky shader (Week 6)" },
      { who: "jo", what: "Suggested a spring easing for his paddle (Week 7)" },
    ],
    journeys: [
      {
        id: "demo-little-worlds",
        title: "Little Worlds",
        phase: "Alpha",
        blurb: "A tiny world that reacts to whoever is looking at it.",
        latest: "Night palette: warm accent?",
        openDecision: true,
        following: 312,
        cover: null,
      },
    ],
    isSelf,
  };
}

function kindStyle(kind: ThinkingItem["kind"]) {
  if (kind === "Dead end") return "text-red-400 border-red-400/30";
  if (kind === "Decision") return "text-amber-300 border-amber-400/30";
  return "text-emerald-400 border-emerald-400/30";
}

export default function CreatorProfile({
  handle: handleProp,
  onClose,
}: {
  handle?: string | null;
  onClose?: () => void;
}) {
  const vaultHandle = useShellUi((s) => s.vaultHandle);
  const closeVault = () => useShellUi.getState().closeVault();
  const close = onClose || closeVault;
  const handle = (handleProp || vaultHandle || "mike").replace(/^@/, "");
  const { data: onb } = useOnboarding() as any;
  const selfHandle = String(onb?.name || "")
    .replace(/^@/, "")
    .toLowerCase();
  const isSelf =
    handle === "me" ||
    (selfHandle && handle === selfHandle) ||
    (onb?.uid && handle === onb.uid);
  // "guest" handle is never a real profile owner
  const lookingAtGuestPlaceholder = handle === "guest" || handle === "Guest";

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const uid = currentUid();
    const q = handle === "me" && uid ? `?userId=${encodeURIComponent(uid)}` : `?handle=${encodeURIComponent(handle)}`;
    fetch(`/api/profile${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const p = d.profile || d;
        if (!p?.handle && !p?.id) {
          // No row yet — empty self profile, not demo fiction
          const h = handle.replace(/^@/, "") || "you";
          setProfile({
            handle: h,
            displayName: h,
            roleLine: "",
            bio: "",
            openToCollab: true,
            journeyCount: 0,
            recordLine: "",
            activityWeeks: Array(12).fill(false),
            thinking: [],
            skills: [],
            vouch: { quote: "", by: "", context: "" },
            helped: [],
            journeys: [],
            isSelf: !!isSelf,
          });
          return;
        }
        const thinking = (p.thinking || []).map((item: any) => ({
          id: item.id,
          kind: item.kind as ThinkingItem["kind"],
          project: item.project,
          week: item.week,
          title: item.title,
          body: item.body,
        }));
        setProfile({
          handle: p.handle || handle,
          displayName: p.displayName || p.handle || handle,
          avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : null,
          roleLine: p.roleLine || p.levelTrack || "",
          bio: typeof p.bio === "string" ? p.bio : "",
          openToCollab: p.openToCollab !== false,
          journeyCount: p.counts?.projects ?? p.projectCount ?? p.projects?.length ?? 0,
          recordLine: p.recordLine || "",
          activityWeeks: Array.isArray(p.activityWeeks) && p.activityWeeks.length
            ? p.activityWeeks
            : Array(12).fill(false),
          thinking,
          skills: (p.skills && p.skills.length ? p.skills : []) as string[],
          vouch: p.vouch || { quote: "", by: "", context: "" },
          helped: (p.helped || []).map((h: any) => ({ who: h.who, what: h.what })),
          journeys: (p.projects || []).map((pr: any) => ({
            id: pr.id,
            title: pr.title,
            phase: pr.status === "COMPLETED" ? "Done" : "In progress",
            blurb: pr.intent || pr.intentStatement || "",
            latest: pr.latest || "Open",
            following: pr.followerCount || 0,
            cover: pr.cover || pr.coverImageUrl || null,
            openDecision: false,
          })),
          isSelf: !!p.isSelf || !!isSelf,
        });
      })
      .catch(() => {
        if (!cancelled) {
          const h = handle.replace(/^@/, "") || "you";
          setProfile({
            handle: h,
            displayName: h,
            roleLine: "",
            bio: "",
            openToCollab: true,
            journeyCount: 0,
            recordLine: "",
            activityWeeks: Array(12).fill(false),
            thinking: [],
            skills: [],
            vouch: { quote: "", by: "", context: "" },
            helped: [],
            journeys: [],
            isSelf: !!isSelf,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle, isSelf]);

  const saveProfile = async () => {
    const uid = currentUid();
    if (!uid) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "edit your profile" }));
      return;
    }
    setSavingProfile(true);
    setProfileError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          displayName: editDisplayName.trim(),
          bio: editBio.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      setProfile((current) => current ? {
        ...current,
        displayName: result.user?.displayName || editDisplayName.trim(),
        bio: result.user?.bio ?? editBio.trim(),
      } : current);
      setEditingProfile(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="absolute inset-0 bg-[var(--page)] grid place-items-center text-[13px] text-[var(--text-muted)]">
        Loading profile…
      </div>
    );
  }

  // Guest cannot open profiles
  const signedUid = currentUid();
  if (!signedUid && !profile.isSelf) {
    return (
      <div className="absolute inset-0 bg-[var(--page)] z-50 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[15px] text-[var(--text)] text-center">Sign in to view profiles.</p>
        <button
          type="button"
          onClick={() => {
            close();
            try {
              window.dispatchEvent(new CustomEvent("wippo:auth"));
            } catch {}
          }}
          className="rounded-full bg-[var(--coral)] px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          Sign in
        </button>
        <button type="button" onClick={close} className="text-[12px] text-[var(--text-faint)]">
          Back
        </button>
      </div>
    );
  }

  const focusHours = profile.activityWeeks.filter(Boolean).length * 4;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0B0C0E] z-50">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0C0E]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center gap-2">
        <button type="button" onClick={close} className="text-[12px] text-white/50 hover:text-white">
          ← Back
        </button>
        <span className="text-[12px] text-white/35 truncate">@{profile.handle}</span>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 pb-24 font-mono">
        {/* Wireframe identity block */}
        <header className="rounded-xl border border-dashed border-white/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="relative shrink-0">
                <Avatar handle={profile.handle} size={56} src={profile.avatarUrl} className="shrink-0" />
                {profile.isSelf && (
                  <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full border border-white/20 bg-[#1a1d22] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/70 hover:text-white hover:border-white/40">
                    Edit
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.target;
                        const file = input.files?.[0];
                        if (!file) return;
                        const uid = currentUid();
                        if (!uid) {
                          setProfileError("Sign in again to update your photo.");
                          return;
                        }
                        if (!file.type.startsWith("image/")) {
                          setProfileError("Choose an image file.");
                          return;
                        }
                        if (file.size > 8 * 1024 * 1024) {
                          setProfileError("Image is too large (max 8MB).");
                          return;
                        }
                        setProfileError("");
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const up = await fetch("/api/upload", { method: "POST", body: fd });
                          const upJson = await up.json().catch(() => ({}));
                          if (!up.ok) {
                            throw new Error(upJson.error || "Could not upload photo.");
                          }
                          const url = upJson.url as string;
                          if (!url) throw new Error("Upload returned no URL.");

                          const response = await fetch("/api/profile", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: uid, avatarUrl: url }),
                          });
                          const result = await response.json().catch(() => ({}));
                          if (!response.ok) {
                            throw new Error(result.error || "Could not save photo.");
                          }
                          setProfile((p) => (p ? { ...p, avatarUrl: url } : p));
                        } catch (error) {
                          setProfileError(
                            error instanceof Error ? error.message : "Could not update photo."
                          );
                        } finally {
                          input.value = "";
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-[18px] sm:text-[20px] font-semibold text-white tracking-tight">
                  {profile.displayName || profile.handle}
                </h1>
                <p className="mt-0.5 text-[12px] text-white/55">
                  {profile.roleLine || "Builder"}
                  {profile.openToCollab && (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-emerald-300/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Open to Collaborations
                    </span>
                  )}
                </p>
                {profile.bio ? (
                  <p className="mt-2 text-[13px] text-white/60 leading-relaxed max-w-xl">
                    &ldquo;{profile.bio}&rdquo;
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-white/45 tracking-wide">
                  <span className="text-white/70">{focusHours}</span> Focus Hours Logged
                  <span className="text-white/25"> · </span>
                  <span className="text-white/70">{profile.journeyCount}</span> Active Journeys
                  <span className="text-white/25"> · </span>
                  <span className="text-white/70">{profile.helped.length}</span> Bottlenecks Unblocked
                </p>
              </div>
            </div>
            {profile.isSelf ? (
              <button
                type="button"
                onClick={() => {
                  setEditDisplayName(profile.displayName);
                  setEditBio(profile.bio);
                  setProfileError("");
                  setEditingProfile((open) => !open);
                }}
                className="shrink-0 rounded-lg border border-dashed border-white/30 px-3 py-1.5 text-[11px] uppercase tracking-wider text-white/80 hover:border-white/50"
              >
                {editingProfile ? "Cancel" : "Edit Profile"}
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const uid = currentUid();
                    if (!uid) {
                      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "message a builder" }));
                      return;
                    }
                    useShellUi.getState().openInbox();
                    window.dispatchEvent(new CustomEvent("wippo:message", { detail: { handle: profile.handle } }));
                  }}
                  className="rounded-lg border border-dashed border-white/25 px-3 py-1.5 text-[11px] text-white/70 hover:text-white"
                >
                  Message
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const uid = currentUid();
                    if (!uid) {
                      window.dispatchEvent(new CustomEvent("wippo:auth"));
                      return;
                    }
                    try {
                      await toggleUserFollow(profile.handle, following);
                      setFollowing((f) => !f);
                    } catch {}
                  }}
                  className="rounded-lg border border-dashed border-white/30 px-3 py-1.5 text-[11px] uppercase tracking-wider text-white/80"
                >
                  {following ? "Following" : "Follow"}
                </button>
              </div>
            )}
          </div>

          {profile.isSelf && editingProfile && (
            <form
              className="mt-4 space-y-3 border-t border-dashed border-white/15 pt-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const uid = currentUid();
                if (!uid) return;
                setSavingProfile(true);
                setProfileError("");
                try {
                  const response = await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: uid,
                      displayName: editDisplayName.trim(),
                      bio: editBio.trim(),
                    }),
                  });
                  const result = await response.json().catch(() => ({}));
                  if (!response.ok) throw new Error(result.error || "Could not save profile.");
                  setProfile((p) =>
                    p
                      ? {
                          ...p,
                          displayName: editDisplayName.trim() || p.displayName,
                          bio: editBio.trim(),
                        }
                      : p
                  );
                  setEditingProfile(false);
                } catch (error) {
                  setProfileError(error instanceof Error ? error.message : "Could not save profile.");
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              <label className="block text-[11px] text-white/45">
                Name
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  maxLength={48}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-white/30"
                />
              </label>
              <label className="block text-[11px] text-white/45">
                Bio
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={280}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-white/30"
                />
              </label>
              {profileError && <p role="alert" className="text-[11px] text-red-300">{profileError}</p>}
              <button
                type="submit"
                disabled={savingProfile || !editDisplayName.trim()}
                className="rounded-lg border border-dashed border-white/30 px-3 py-1.5 text-[11px] uppercase tracking-wider text-white disabled:opacity-40"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}
        </header>

        {/* Active project journeys */}
        <section className="mt-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Active project journeys
          </h2>
          {profile.journeys.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-[12px] text-white/35">
              No active journeys yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile.journeys.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => useShellUi.getState().openProject(j.id)}
                  className="rounded-xl border border-dashed border-white/20 overflow-hidden text-left hover:border-white/40 transition-colors"
                >
                  <div className="relative aspect-video bg-[#0a0b0d]">
                    {j.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-wider text-white/30">
                        [15s video reel preview]
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 border-t border-dashed border-white/15">
                    <p className="text-[13px] font-medium text-white">
                      {j.title}
                      {j.phase ? <span className="text-white/40"> ({j.phase})</span> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50 line-clamp-1">
                      {j.latest ? `Update: ${j.latest}` : j.blurb || "Open journey"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Verified proof of work */}
        <section className="mt-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Verified proof of work &amp; help highlights
          </h2>
          <div className="rounded-xl border border-dashed border-white/20 px-4 py-3">
            {profile.helped.length === 0 ? (
              <p className="text-[12px] text-white/35">No help highlights yet.</p>
            ) : (
              <ul className="space-y-2 text-[12px] text-white/70">
                {profile.helped.map((item, index) => (
                  <li key={`${item.who}-${index}`}>
                    <span className="text-white/40">· </span>
                    Unblocked <span className="text-emerald-300/90">@{item.who}</span> on {item.what}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
