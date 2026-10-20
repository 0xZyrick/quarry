"use client";

import { useState } from "react";

export type ExportCardData = {
  projectId: string;
  projectName: string;
  title: string;
  summary: string;
  updateNumber: number;
  phase: string;
  handle: string;
};

function paintCard(data: ExportCardData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Could not create the export image."));
      return;
    }
    context.fillStyle = "#0b0c0e";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111820";
    context.fillRect(42, 42, 1116, 546);
    context.strokeStyle = "rgba(255,255,255,.16)";
    context.strokeRect(42, 42, 1116, 546);
    context.fillStyle = "#10b981";
    context.font = "700 24px Arial";
    context.fillText(`WIPPO LOG #${String(data.updateNumber).padStart(3, "0")}`, 84, 112);
    context.fillStyle = "#ffffff";
    context.font = "700 44px Arial";
    context.fillText(data.title.slice(0, 48), 84, 220);
    context.fillStyle = "#aab2bd";
    context.font = "24px Arial";
    context.fillText(`${data.projectName}  ·  ${data.phase}`, 84, 280);
    context.fillStyle = "#e5e7eb";
    context.font = "28px Arial";
    const words = data.summary.split(/\s+/);
    let line = "";
    let y = 360;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > 1010 && line) {
        context.fillText(line, 84, y);
        line = word;
        y += 42;
        if (y > 490) break;
      } else {
        line = next;
      }
    }
    if (line && y <= 490) context.fillText(line, 84, y);
    context.fillStyle = "#9ca3af";
    context.font = "20px Arial";
    context.fillText(`Verified on Wippo  ·  @${data.handle}  ·  wippo.dev/project/${data.projectId}`, 84, 540);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the export image."));
    }, "image/png");
  });
}

export default function SocialExportCard({
  data,
  onClose,
}: {
  data: ExportCardData;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const number = String(data.updateNumber).padStart(3, "0");
  const projectUrl = `/project/${encodeURIComponent(data.projectId)}`;
  const shareUrl = typeof window === "undefined"
    ? projectUrl
    : new URL(projectUrl, window.location.origin).toString();

  const saveImage = async () => {
    setError("");
    try {
      const blob = await paintCard(data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wippo-log-${number}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export image.");
    }
  };

  const shareText = encodeURIComponent(`${data.title} · ${data.projectName} · Wippo Log #${number}`);

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-black/75 px-4 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-card-title"
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#111318] p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="export-card-title" className="text-[16px] font-semibold text-white">
              Update #{number} published
            </h2>
            <p className="mt-1 text-[12px] text-white/55">
              Added to <a href={projectUrl} className="text-white underline">{data.projectName}</a> Journey.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[12px] text-white/50 hover:text-white">Close</button>
        </div>

        <div className="mt-5 rounded-xl border border-white/15 bg-[#0b0c0e] p-5 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
            Wippo Log #{number}
          </p>
          <h3 className="mt-5 text-[22px] font-semibold text-white">{data.title}</h3>
          <p className="mt-2 text-[12px] text-white/55">
            <a href={projectUrl} className="underline">{data.projectName}</a>
            {" · "}{data.phase}
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-white/80">{data.summary}</p>
          <p className="mt-8 border-t border-white/10 pt-3 text-[10px] text-white/40">
            Verified on Wippo · @{data.handle}
          </p>
        </div>

        {error && <p role="alert" className="mt-3 text-[12px] text-red-300">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void saveImage()} className="rounded-full bg-white px-4 py-2 text-[11px] font-semibold text-black">
            Download image
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-4 py-2 text-[11px] text-white/75"
          >
            Share to X
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-4 py-2 text-[11px] text-white/75"
          >
            LinkedIn
          </a>
        </div>
      </section>
    </div>
  );
}
