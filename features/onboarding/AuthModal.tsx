"use client";

import { useEffect, useState } from "react";
import { useOnboarding } from "./OnboardingProvider";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
  onSuccess?: () => void;
  /** When true, this is the landing gate — close is hidden, guest still allowed */
  landing?: boolean;
};

type Mode = "join" | "signin" | "link";
type Step = "email" | "otp" | "profile";

export default function AuthModal({ open, reason, onClose, onSuccess, landing }: Props) {
  const { update, data } = useOnboarding();
  const [mode, setMode] = useState<Mode>("join");
  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [studioCode, setStudioCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const r = (reason || "").toLowerCase();
    setMode(r.includes("email sign-in") || r.includes("link") ? "link" : r.includes("sign in") || r.includes("welcome back") ? "signin" : "join");
    setStep("email");
    setOtpSent(false);
    setEmail("");
    setName("");
    setToken("");
    setStudioCode("");
    setAccountId(null);
    setErr("");
  }, [open, reason]);

  const finish = (uid: string, handle: string, track?: string | null) => {
    update({
      uid,
      name: handle,
      auth: "invite",
      explored: true,
      track: (track as "creator" | "client" | "guest") || "creator",
    });
    onSuccess?.();
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErr("");

    // —— EMAIL → request OTP ——
    if (step === "email") {
      if (!email.trim()) {
        setErr("Enter your email address.");
        return;
      }
      setBusy(true);
      try {
        const endpoint =
          mode === "join"
            ? "/api/invite"
            : mode === "link"
              ? "/api/auth/email/link"
              : "/api/auth/email/request";
        const body =
          mode === "join"
            ? { email: email.trim(), track: "creator" }
            : { email: email.trim() };
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not send a verification code.");
        setOtpSent(true);
        setStep("otp");
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not continue. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // —— OTP → verify ——
    if (step === "otp") {
      if (!token.trim()) {
        setErr("Enter the code from your email.");
        return;
      }
      setBusy(true);
      try {
        const response = await fetch("/api/auth/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), token: token.trim() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not verify your email.");
        const account = result.account;
        if (!account?.id) throw new Error("Verified account response was incomplete.");

        // New join accounts always go through username step
        if (mode === "join") {
          setAccountId(account.id);
          // Pre-fill if server already has a real-looking handle
          const h = String(account.handle || "").replace(/^@/, "");
          if (h && !/^\d+$/.test(h) && h.length >= 2) setName(h);
          setStep("profile");
          return;
        }

        finish(account.id, account.handle, account.track);
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not continue. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // —— PROFILE → username + optional studio code ——
    if (step === "profile") {
      const handle = name.trim().replace(/^@/, "").replace(/\s/g, "");
      if (handle.length < 2) {
        setErr("Choose a username (at least 2 characters).");
        return;
      }
      setBusy(true);
      try {
        const uid = accountId || data.uid;
        if (!uid) throw new Error("Session missing. Request a new code.");

        const profileRes = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, handle }),
        });
        const profileJson = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok) {
          throw new Error(profileJson.error || "That username isn’t available.");
        }

        const finalHandle = profileJson.user?.handle || handle;

        // Optional studio unlock
        if (studioCode.trim()) {
          const studioRes = await fetch("/api/studio/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: studioCode.trim() }),
          });
          // Soft-fail: bad code should not block account creation
          if (!studioRes.ok) {
            const sj = await studioRes.json().catch(() => ({}));
            setErr(sj.error || "Account created, but that studio code wasn’t valid.");
            // still finish — user can unlock later
          }
        }

        finish(uid, finalHandle, "creator");
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not finish setup. Try again.");
      } finally {
        setBusy(false);
      }
    }
  };

  const continueAsGuest = () => {
    update({ explored: true, auth: "guest", name: "", uid: "", track: "guest" });
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  const title =
    step === "otp"
      ? "Check your inbox"
      : step === "profile"
        ? "Choose your username"
        : mode === "join"
          ? "Create your account"
          : mode === "link"
            ? "Add sign-in email"
            : "Welcome back";

  const subtitle =
    step === "otp"
      ? `Enter the one-time code sent to ${email}.`
      : step === "profile"
        ? "This is how others will find you. Studio code is optional."
        : mode === "join"
          ? "Enter your email to get a verification code."
          : mode === "link"
            ? "Verify an email so you can recover this account."
            : "We’ll email you a one-time sign-in code.";

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#080b11] text-white">
      <div className="grid min-h-full lg:grid-cols-2">
        <section className="flex min-h-full flex-col justify-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex items-center justify-between">
              <a href="/" aria-label="Wippo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/wippo-logo.png" alt="Wippo" className="h-8 w-auto object-contain" />
              </a>
              {!landing && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[12px] text-white/50 hover:text-white"
                >
                  Close
                </button>
              )}
            </div>

            <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">{subtitle}</p>

            <form onSubmit={(e) => void submit(e)} className="mt-7 space-y-4">
              {step === "email" && (
                <label className="block text-[11px] font-medium text-white/65">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@email.com"
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[13px] text-white outline-none placeholder:text-white/30"
                  />
                </label>
              )}

              {step === "otp" && (
                <label className="block text-[11px] font-medium text-white/65">
                  One-time code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="000000"
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[13px] tracking-[0.2em] text-white outline-none placeholder:text-white/30"
                  />
                </label>
              )}

              {step === "profile" && (
                <>
                  <label className="block text-[11px] font-medium text-white/65">
                    Username
                    <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-white/[0.04] px-3">
                      <span className="text-white/40">@</span>
                      <input
                        value={name}
                        onChange={(e) =>
                          setName(e.target.value.replace(/\s/g, "").replace(/^@/, "").slice(0, 24))
                        }
                        autoComplete="username"
                        maxLength={24}
                        placeholder="yourname"
                        required
                        className="w-full bg-transparent px-2 py-3 text-[13px] text-white outline-none"
                      />
                    </div>
                  </label>
                  <label className="block text-[11px] font-medium text-white/65">
                    Studio code <span className="text-white/35">(optional)</span>
                    <input
                      value={studioCode}
                      onChange={(e) => setStudioCode(e.target.value)}
                      autoComplete="off"
                      placeholder="Enter if you have one"
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[13px] text-white outline-none placeholder:text-white/30"
                    />
                  </label>
                </>
              )}

              {err && (
                <p role="alert" className="text-[12px] text-red-300">
                  {err}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-white py-3 text-[13px] font-semibold text-black disabled:opacity-50"
              >
                {busy
                  ? "Please wait…"
                  : step === "email"
                    ? "Continue"
                    : step === "otp"
                      ? "Verify"
                      : "Enter Wippo"}
              </button>
            </form>

            {step === "otp" && (
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtpSent(false);
                  setToken("");
                  setErr("");
                }}
                className="mt-4 w-full text-[12px] text-white/45 hover:text-white/75"
              >
                Use a different email or resend
              </button>
            )}

            {step === "email" && (
              <div className="mt-6 flex items-center justify-center gap-3 text-[12px] text-white/45">
                {mode === "join" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErr("");
                    }}
                    className="hover:text-white"
                  >
                    Already have an account? Sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("join");
                      setErr("");
                    }}
                    className="hover:text-white"
                  >
                    New here? Create an account
                  </button>
                )}
              </div>
            )}

            {step === "email" && (
              <>
                <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/35">
                  <span className="h-px flex-1 bg-white/10" />
                  or
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="w-full rounded-xl border border-white/15 py-3 text-[12px] font-semibold text-white/80 hover:bg-white/[0.05]"
                >
                  Continue as guest
                </button>
                <p className="mt-3 text-center text-[10px] text-white/35">
                  Browse freely. Create an account when you need to.
                </p>
              </>
            )}
          </div>
        </section>

        <aside className="relative hidden min-h-full overflow-hidden border-l border-white/10 bg-[#0a0d12] lg:flex lg:flex-col">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 42%, rgba(255,118,95,0.12), transparent 62%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.06), transparent 50%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/wippo-icon.png"
              alt=""
              className="h-14 w-14 object-contain opacity-90"
              draggable={false}
            />
            <h2 className="mt-10 max-w-xs text-[32px] font-semibold leading-[1.12] tracking-tight text-white">
              Build in public.
            </h2>
            <p className="mt-4 max-w-[220px] text-[14px] leading-relaxed text-white/45">
              A live place for work in progress.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
