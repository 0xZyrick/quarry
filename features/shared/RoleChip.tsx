"use client";
import {useGuild, useRole} from "@/lib/store";
import Avatar from "./Avatar";
import type {Gender} from "@/lib/skillMedia";
import {useShellUi} from "@/lib/shellUi";

export default function RoleChip() {
  const ready = useGuild((s) => s.profileReady),
    r = useRole();
  const openVault = useShellUi((s) => s.openVault);
  if (!ready) return null;
  const handle = r.profile?.handle;
  const label =
    r.role === "guest" ? "guest" : r.role === "creator" ? "creator" : "client";
  const c =
    r.role === "client" ? "text-live" : r.role === "creator" ? "text-community" : "text-neutral-400";
  const gender = (r.profile as {gender?: Gender | null} | null)?.gender;
  const short =
    handle && handle.length > 10 ? handle.slice(0, 9) + "…" : handle;
  const inner = (
    <>
      {handle && <Avatar gender={gender} handle={handle} size={20} className="shrink-0" />}
      {short && <span className="text-neutral-300 truncate max-w-[5.5rem]">@{short}</span>}
      <span className={`shrink-0 ${c}`}>{label}</span>
    </>
  );
  if (!handle)
    return (
      <div className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] flex items-center gap-1 min-w-0 ${c}`}>
        {inner}
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => openVault(handle)}
      className={`btn rounded-full px-1.5 py-0.5 font-mono text-[10px] flex items-center gap-1 min-w-0 hover:opacity-90 ${c}`}
      aria-label={`Open PoE Vault @${handle}`}
      title={`@${handle}`}
    >
      {inner}
    </button>
  );
}
