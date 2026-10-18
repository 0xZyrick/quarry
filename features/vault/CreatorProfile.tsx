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
          setProfile(demoProfile(handle, !!isSelf));
          return;
        }
        const base = demoProfile(p.handle || handle, !!p.isSelf || !!isSelf);
        const thinking = (p.thinking || []).map((item: any) => ({
          id: item.id,
          kind: item.kind as ThinkingItem["kind"],
          project: item.project,
          week: item.week,
          title: item.title,
          body: item.body,
        }));
        setProfile({
          ...base,
          handle: p.handle || handle,
          displayName: p.displayName || p.handle || handle,
          bio: p.bio || base.bio,
          journeyCount: p.counts?.projects ?? p.projectCount ?? p.projects?.length ?? base.journeyCount,
          recordLine: p.recordLine || base.recordLine,
          activityWeeks: Array.isArray(p.activityWeeks) && p.activityWeeks.length === 12
            ? p.activityWeeks
            : base.activityWeeks,
          thinking: thinking.length ? thinking : base.thinking,
          skills: (p.skills && p.skills.length ? p.skills : base.skills) as string[],
          helped: (p.helped && p.helped.length
            ? p.helped.map((h: any) => ({ who: h.who, what: h.what }))
            : base.helped),
          journeys:
            (p.projects || []).map((pr: any) => ({
              id: pr.id,
              title: pr.title,
              phase: pr.status === "COMPLETED" ? "Done" : "In progress",
              blurb: pr.intent || "",
              latest: pr.latest || "Open the journey",
              following: pr.followerCount || 0,
              cover: pr.cover || null,
              openDecision: false,
            })) || base.journeys,
          isSelf: !!p.isSelf || !!isSelf,
        });
      })
      .catch(() => {
        if (!cancelled) setProfile(demoProfile(handle, !!isSelf));
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

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[var(--page)] z-50">
      <div className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--page)]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={close}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back
        </button>
        <span className="text-[12px] text-[var(--text-faint)] truncate">@{profile.handle}</span>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 pb-24 space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="relative shrink-0">
            <Avatar handle={profile.handle} size={64} className="shrink-0" />
            {profile.isSelf && (
              <label className="absolute inset-0 rounded-full cursor-pointer grid place-items-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-[10px] text-white font-medium">
                Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // local preview via object URL; persist when upload API exists
                    const url = URL.createObjectURL(file);
                    setProfile((p) => (p ? { ...p, avatarPreview: url } as any : p));
                    try {
                      const uid = currentUid();
                      if (!uid) return;
                      // data URL fallback store in profile PATCH if small
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const dataUrl = String(reader.result || "");
                        if (dataUrl.length > 500_000) return; // skip huge
                        await fetch("/api/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: uid, avatarUrl: dataUrl }),
                        });
                      };
                      reader.readAsDataURL(file);
                    } catch {}
                  }}
                />
              </label>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2 justify-between">
              <div>
                <h1 className="text-[22px] font-semibold text-[var(--text)]">{profile.displayName}</h1>
                <p className="text-[13px] text-[var(--text-muted)]">{profile.roleLine}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-faint)]">
                  {profile.openToCollab && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Open to collaborations
                    </span>
                  )}
                  <span>📁 {profile.journeyCount} Journey{profile.journeyCount === 1 ? "" : "s"}</span>
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
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-medium text-[var(--text)]"
                >
                  {editingProfile ? "Cancel edit" : "Edit profile"}
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
                      window.dispatchEvent(new CustomEvent("wippo:message", {
                        detail: { handle: profile.handle },
                      }));
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text)]"
                  >
                    Work with {profile.displayName}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const uid = currentUid();
                      if (!uid) {
                        try {
                          window.dispatchEvent(new CustomEvent("wippo:auth"));
                        } catch {}
                        return;
                      }
                      try {
                        await toggleUserFollow(profile.handle, following);
                        setFollowing((f) => !f);
                      } catch {}
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      following
                        ? "border border-[var(--line)] text-[var(--text)]"
                        : "bg-[var(--coral)] text-white"
                    }`}
                  >
                    {following ? "Following" : "Follow"}
                  </button>
                </div>
              )}
            </div>
            <p className="mt-3 text-[14px] text-[var(--text-muted)] leading-relaxed max-w-xl">
              {profile.bio}
            </p>
          </div>
        </header>

        {editingProfile && profile.isSelf && (
          <form
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] text-[var(--text-faint)]">
                Name
                <input
                  value={editDisplayName}
                  onChange={(event) => setEditDisplayName(event.target.value)}
                  maxLength={48}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                />
              </label>
              <label className="block text-[11px] text-[var(--text-faint)]">
                What you make
                <textarea
                  value={editBio}
                  onChange={(event) => setEditBio(event.target.value)}
                  maxLength={280}
                  rows={2}
                  className="mt-1 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                />
              </label>
            </div>
            {profileError && <p role="alert" className="mt-3 text-[11px] text-red-300">{profileError}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile || !editDisplayName.trim()}
                className="rounded-full bg-[var(--coral)] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        )}

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--growth)]">The work, in motion</p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text)]">Projects before profile</h2>
            </div>
            <p className="max-w-md text-[12px] leading-relaxed text-[var(--text-faint)]">{profile.recordLine}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {profile.journeys.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => useShellUi.getState().openProject(j.id)}
                className="group relative min-h-[15rem] overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5 text-left transition-transform duration-300 hover:-translate-y-1"
              >
                {j.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                  <img src={j.cover} alt={`Latest work on ${j.title}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                )}
                <span className={`absolute inset-0 ${j.cover ? "bg-gradient-to-t from-[#090c12] via-[#090c12]/65 to-[#090c12]/10" : "bg-[radial-gradient(ellipse_at_top_right,rgba(159,227,192,.12),transparent_55%),linear-gradient(145deg,#14201f,#090c12_75%)]"}`} />
                <span className="relative inline-flex rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] font-medium text-white/80">
                  {j.phase}{j.openDecision ? " · Open decision" : ""}
                </span>
                <div className="relative mt-16">
                  <p className="text-[19px] font-semibold tracking-tight text-white">{j.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/75">{j.blurb}</p>
                  <p className="mt-3 border-t border-white/15 pt-3 text-[11px] text-white/60">Latest trace · {j.latest}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 border-t border-[var(--line)] pt-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">From the process</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text)]">Notes from the work</h2>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {profile.thinking.map((item) => (
                <article key={item.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${kindStyle(item.kind)}`}>{item.kind}</span>
                    <span className="text-[var(--text-faint)]">{item.project} · {item.week}</span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold text-[var(--text)]">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-5 lg:pt-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Tools in the work</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">{skill}</span>
                ))}
              </div>
            </div>
            {profile.vouch && (
              <blockquote className="border-l-2 border-[var(--growth)]/60 pl-3">
                <p className="text-[13px] italic leading-relaxed text-[var(--text-muted)]">“{profile.vouch.quote}”</p>
                <footer className="mt-2 text-[10px] text-[var(--text-faint)]">— {profile.vouch.by}, {profile.vouch.context}</footer>
              </blockquote>
            )}
            {profile.helped.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Help passed along</p>
                <ul className="mt-2 space-y-2">
                  {profile.helped.map((item, index) => (
                    <li key={`${item.who}-${index}`} className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text)]">{item.who}</span> · {item.what}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
