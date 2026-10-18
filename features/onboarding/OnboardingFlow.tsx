"use client";
/**
 * Smooth onboarding: Welcome → Auth → Interests → Meet creators → Feed
 * Not a professional networking form — entering a creative place.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnboarding } from "./OnboardingProvider";
import { INTEREST_TILES, isSignedIn, Track } from "@/lib/onboarding";
import Avatar from "../shared/Avatar";
import { currentUid } from "@/lib/circle";
import { Funnel } from "@/lib/analytics";

type Step = "welcome" | "auth" | "interests" | "creators" | "done";
type AuthMode = "join" | "signin";

const DEMO_CREATORS = [
  {
    handle: "mira",
    gender: "female" as const,
    bio: "Interfaces & quiet product craft",
    thumbs: [
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&q=80",
      "https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&q=80",
      "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=200&q=80",
    ],
  },
  {
    handle: "kodo",
    gender: "male" as const,
    bio: "Shaders, noise, organic systems",
    thumbs: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80",
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=200&q=80",
      "https://images.unsplash.com/photo-1618336753974-aae8e14eace7?w=200&q=80",
    ],
  },
  {
    handle: "ayo",
    gender: "male" as const,
    bio: "Game loops & playtests",
    thumbs: [
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&q=80",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&q=80",
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&q=80",
    ],
  },
];

export default function OnboardingFlow({ onFinished }: { onFinished?: () => void }) {
  const { data, update, signedIn } = useOnboarding();
  const [step, setStep] = useState<Step>(() =>
    isSignedIn(data) ? "interests" : "welcome"
  );
  const [handle, setHandle] = useState(data.name?.replace(/^@/, "") || "");
  const [track, setTrack] = useState<Track>(data.track === "client" ? "client" : "creator");
  const [invite, setInvite] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("join");
  const [gender, setGender] = useState<"male" | "female" | null>(data.gender);
  const [interests, setInterests] = useState<string[]>(data.tags || []);
  const [following, setFollowing] = useState<Record<string, true>>({});
  const [handleStatus, setHandleStatus] = useState<"idle" | "ok" | "bad" | "check">("idle");
  const [handleReason, setHandleReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Debounced handle check
  useEffect(() => {
    if (step !== "auth" || authMode !== "join" || handle.trim().length < 2) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("check");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/handles/check?handle=${encodeURIComponent(handle)}&excludeUid=${encodeURIComponent(data.uid || "")}`
        );
        const d = await r.json();
        if (d.available) {
          setHandleStatus("ok");
          setHandleReason("");
        } else {
          setHandleStatus("bad");
          setHandleReason(d.reason || "Unavailable");
        }
      } catch {
        setHandleStatus("ok"); // offline soft allow
      }
    }, 350);
    return () => clearTimeout(t);
  }, [handle, step, data.uid, authMode]);

  const toggleInterest = (id: string) => {
    setInterests((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const primaryZone = useMemo(() => {
    const tile = INTEREST_TILES.find((t) => interests.includes(t.id));
    return tile?.zone || null;
  }, [interests]);

  const finish = (partial?: Partial<typeof data>) => {
    Funnel.personalize({ count: interests.length, zone: primaryZone || "" });
    Funnel.onboarding_complete({
      followed: Object.keys(following).length,
      interests: interests.length,
    });
    update({
      explored: true,
      track,
      tags: interests,
      gender: gender || data.gender,
      zone: primaryZone || data.zone,
      ...partial,
    } as any);
    // Persist interests + gender to profile when signed in
    const uid = data.uid || currentUid();
    if (uid) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          handle: data.name,
          gender: gender || undefined,
          // interests stored via tags client-side; profile API can ignore unknown
        }),
      }).catch(() => {});
    }
    try {
      localStorage.setItem(
        "wippo.interests.v1",
        JSON.stringify({ interests, zone: primaryZone, following: Object.keys(following) })
      );
    } catch {}
    onFinished?.();
  };

  const doAuth = async () => {
    setBusy(true);
    setErr("");
    try {
      if (!otpSent) {
        const r = await fetch(authMode === "join" ? "/api/invite" : "/api/auth/email/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authMode === "join"
            ? { code: invite.trim(), name: handle.trim(), email: email.trim(), track }
            : { email: email.trim() }),
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(result.error || "Could not send a verification code");
        setOtpSent(true);
        setErr("");
        return;
      }

      const verification = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: otp.trim() }),
      });
      const result = await verification.json().catch(() => ({}));
      if (!verification.ok) throw new Error(result.error || "Could not verify your email");
      const account = result.account;
      if (!account?.id || !account?.handle) throw new Error("Verified account response was incomplete");
      update({
        uid: account.id,
        name: account.handle,
        auth: "invite",
        gender,
        track: account.track || track,
        explored: true,
      } as any);
      Funnel.join({ handle: account.handle });
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: account.id,
          gender,
        }),
      }).catch(() => {});
      setStep("interests");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Network issue — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#080b11]">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative isolate min-h-full flex flex-col overflow-hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-48 left-[12%] h-[34rem] w-[34rem] rounded-full bg-[#ff765f]/[0.08] blur-[100px]" />
              <div className="absolute -right-32 top-[30%] h-[30rem] w-[30rem] rounded-full bg-[#829cff]/[0.08] blur-[100px]" />
              <div className="absolute inset-0 opacity-[0.12] peek-grid [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
            </div>
            <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-5 max-w-7xl w-full mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/wippo-logo.png" alt="wippo" className="h-9 w-auto object-contain" />
              <button
                type="button"
                onClick={() => {
                  setAuthMode("join");
                  setOtpSent(false);
                  setStep("auth");
                }}
                className="text-[12px] text-white/55 hover:text-white font-medium"
              >
                Have an invite? Join
              </button>
            </header>

            <div className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-5 sm:px-10 py-8 sm:py-12 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-14 items-center">
              <section>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--growth)] shadow-[0_0_12px_var(--growth)]" />
                The work is the story
              </p>
              <h1 className="max-w-xl text-[2.35rem] sm:text-[3.2rem] lg:text-[4.25rem] font-semibold text-white tracking-[-0.055em] leading-[0.98]">
                A live atlas of work in progress.
              </h1>
              <p className="mt-5 max-w-lg text-[14px] sm:text-[15px] text-white/55 leading-relaxed">
                Step into a room, work alongside makers, and leave with a real record of how it came together.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 text-[10px] text-white/50">
                {["Live workrooms", "Chronological project trails", "Help when you're stuck"].map((item) => (
                  <span key={item} className="rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-2">{item}</span>
                ))}
              </div>
              <div className="mt-9 max-w-sm space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("join");
                    setOtpSent(false);
                    setStep("auth");
                  }}
                  className="w-full rounded-2xl py-4 text-[13px] font-semibold bg-[var(--coral)] text-[#170b09] shadow-[0_10px_35px_rgba(255,118,95,.18)] hover:brightness-110"
                >
                  Join with an invite <span aria-hidden>↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Funnel.explore({ mode: "guest" });
                    update({ explored: true, auth: "guest" } as any);
                    onFinished?.();
                  }}
                  className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.025] py-3.5 text-[12px] text-white/65 hover:bg-white/[0.06] hover:text-white"
                >
                  Enter as a guest · explore before joining
                </button>
              </div>
              </section>

              <section className="relative min-h-[22rem] sm:min-h-[31rem] rounded-[2rem] border border-white/[0.09] bg-white/[0.025] p-3 sm:p-4 shadow-[0_30px_100px_rgba(0,0,0,.32)]">
                <div className="absolute left-8 top-8 z-10 rounded-full border border-white/15 bg-[#0d131c]/80 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">
                  LIVE SESSION · 04 PEOPLE BUILDING
                </div>
                <div className="grid h-full min-h-[20rem] sm:min-h-[29rem] grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-[1.4rem]">
              {[
                "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80",
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80",
                "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&q=80",
                "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80",
              ].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={`w-full h-full object-cover rounded-xl ${
                    i === 0 ? "row-span-2" : ""
                  }`}
                />
              ))}
                </div>
                <div className="absolute bottom-7 left-7 right-7 rounded-2xl border border-white/10 bg-[#0b1018]/75 p-4 backdrop-blur-xl">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--growth)]">Project journey · update 09</p>
                  <p className="mt-1 text-[14px] font-medium text-white">A rough edge, a dead end, the next attempt.</p>
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {step === "auth" && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-full flex flex-col items-center justify-center px-5 py-12"
          >
            <div className="w-full max-w-sm">
              <h2 className="text-[1.35rem] font-semibold text-white text-center">
                {otpSent ? "Check your inbox" : authMode === "join" ? "Join Wippo" : "Welcome back"}
              </h2>
              <p className="mt-1.5 text-[13px] text-white/45 text-center">
                {otpSent
                  ? `Enter the one-time code sent to ${email}.`
                  : authMode === "join"
                    ? "Create your account with an invite and verify your email."
                    : "We’ll email you a one-time sign-in code."}
              </p>

              {!otpSent && authMode === "join" && <div className="mt-6 grid grid-cols-2 gap-2">
                {([
                  ["creator", "I'm building", "Share work, host sessions, invite crew"],
                  ["client", "I own a project", "Bring a brief, find collaborators"],
                ] as const).map(([value, label, detail]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={track === value}
                    onClick={() => setTrack(value)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      track === value
                        ? "border-[var(--coral)]/70 bg-[var(--coral)]/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="block text-[12px] font-semibold text-white">{label}</span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-white/45">{detail}</span>
                  </button>
                ))}
              </div>}

              {!otpSent && authMode === "join" && <label className="mt-8 block">
                <span className="text-[10px] uppercase tracking-wider text-white/35">
                  Username
                </span>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <span className="text-white/30">@</span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/\s/g, "").slice(0, 24))}
                    className="flex-1 bg-transparent text-[14px] text-white outline-none"
                    placeholder="yourname"
                    autoComplete="username"
                  />
                  {handleStatus === "ok" && (
                    <span className="text-[11px] text-[var(--growth)]">Available</span>
                  )}
                  {handleStatus === "bad" && (
                    <span className="text-[11px] text-red-400">Taken</span>
                  )}
                </div>
                {handleReason && (
                  <p className="mt-1 text-[11px] text-red-400">{handleReason}</p>
                )}
              </label>}

              {!otpSent && authMode === "join" && <div className="mt-4">
                <span className="text-[10px] uppercase tracking-wider text-white/35">
                  Avatar
                </span>
                <div className="mt-2 flex gap-3">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 rounded-2xl border px-3 py-3 flex flex-col items-center gap-2 transition-colors ${
                        gender === g
                          ? "border-[var(--coral)] bg-[var(--coral)]/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <Avatar handle={handle || g} gender={g} size={48} />
                      <span className="text-[12px] text-white/70 capitalize">{g}</span>
                    </button>
                  ))}
                </div>
              </div>}

              <label className={`${otpSent ? "mt-6" : "mt-4"} block`}>
                <span className="text-[10px] uppercase tracking-wider text-white/35">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={otpSent}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none disabled:opacity-60"
                  placeholder="you@example.com"
                />
              </label>

              {!otpSent && authMode === "join" && <label className="mt-4 block">
                <span className="text-[10px] uppercase tracking-wider text-white/35">
                  Invite code
                </span>
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none"
                  placeholder="Your invitation code"
                />
              </label>}

              {otpSent && <label className="mt-4 block">
                <span className="text-[10px] uppercase tracking-wider text-white/35">One-time code</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center font-mono text-[20px] tracking-[0.35em] text-white outline-none"
                  placeholder="000000"
                  required
                />
              </label>}

              {err && <p className="mt-3 text-[12px] text-red-400">{err}</p>}

              {!otpSent && <button
                type="button"
                onClick={() => setAuthMode(authMode === "join" ? "signin" : "join")}
                className="mt-4 w-full text-[12px] text-white/50 hover:text-white"
              >
                {authMode === "join" ? "Already have an account? Sign in" : "New to Wippo? Join with an invite"}
              </button>}

              <button
                type="button"
                disabled={busy || (otpSent
                  ? otp.trim().length < 6
                  : !email.trim() || (authMode === "join" && (handle.trim().length < 2 || handleStatus === "bad")))}
                onClick={doAuth}
                className="mt-6 w-full rounded-full py-3.5 text-[14px] font-semibold bg-[var(--coral)] text-white disabled:opacity-40"
              >
                {busy ? "…" : otpSent ? "Verify and continue" : "Email me a code"}
              </button>
              {otpSent && <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setOtpSent(false);
                }}
                className="mt-3 w-full text-[12px] text-white/40 hover:text-white/70"
              >
                Use a different email or resend
              </button>}
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setStep("welcome");
                }}
                className="mt-3 w-full text-[12px] text-white/40"
              >
                Back
              </button>
            </div>
          </motion.div>
        )}

        {step === "interests" && (
          <motion.div
            key="interests"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-full flex flex-col px-4 py-10 max-w-lg mx-auto"
          >
            <h2 className="text-[1.35rem] font-semibold text-white">
              What do you love seeing people make?
            </h2>
            <p className="mt-1 text-[13px] text-white/45">
              Choose a few. You can change these later.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {INTEREST_TILES.map((t) => {
                const on = interests.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleInterest(t.id)}
                    className={`text-left rounded-2xl border px-3.5 py-3.5 transition-colors ${
                      on
                        ? "border-[var(--coral)] bg-[#2a1814] text-white"
                        : "border-white/10 bg-white/[0.03] text-white/80"
                    }`}
                  >
                    <p className="text-[13px] font-semibold flex items-center justify-between">
                      {t.label}
                      {on && <span className="text-[var(--coral)]">✓</span>}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">{t.sub}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[12px] text-white/35">
              {interests.length} selected
            </p>

            <button
              type="button"
              onClick={() => setStep("creators")}
              className="mt-4 w-full rounded-full py-3.5 text-[14px] font-semibold bg-white text-black"
            >
              Continue with selected interests
            </button>
            <button
              type="button"
              onClick={() => setStep("creators")}
              className="mt-3 text-[13px] text-white/40"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        {step === "creators" && (
          <motion.div
            key="creators"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-full flex flex-col px-4 py-10 max-w-lg mx-auto"
          >
            <h2 className="text-[1.35rem] font-semibold text-white">
              Meet a few makers
            </h2>
            <p className="mt-1 text-[13px] text-white/45">
              Follow anyone who feels like your people. Or skip — no minimum.
            </p>

            <ul className="mt-6 space-y-3">
              {DEMO_CREATORS.map((c) => (
                <li
                  key={c.handle}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar handle={c.handle} gender={c.gender} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-white">@{c.handle}</p>
                      <p className="text-[12px] text-white/45">{c.bio}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFollowing((f) => {
                          const n = { ...f };
                          if (n[c.handle]) delete n[c.handle];
                          else n[c.handle] = true;
                          return n;
                        })
                      }
                      className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                        following[c.handle]
                          ? "bg-white/10 text-white"
                          : "bg-[var(--coral)] text-white"
                      }`}
                    >
                      {following[c.handle] ? "Following" : "Follow"}
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {c.thumbs.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="aspect-square object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => finish()}
              className="mt-6 w-full rounded-full py-3.5 text-[14px] font-semibold bg-[var(--coral)] text-white"
            >
              Enter your feed
            </button>
            <button
              type="button"
              onClick={() => finish()}
              className="mt-3 text-[13px] text-white/40 text-center"
            >
              Skip and explore
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
