"use client";
import {useEffect, useRef} from "react";
import {ZONES} from "@/lib/map";

const TAU = Math.PI * 2, DUR = 2200;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const rad = (d: number) => (d * Math.PI) / 180;

/** Interactive globe — rotates only when the user drags. Zone dots show subtle name tags. */
export default function Globe({target, onLanded, onArrive, reduce: reduceProp}: {target: string | null; onLanded?: () => void; onArrive?: () => void; reduce?: boolean}) {
  const arrive = onLanded ?? onArrive ?? (() => {});
  const cv = useRef<HTMLCanvasElement>(null);
  const tgt = useRef(target);
  const cb = useRef(arrive);
  const spinRef = useRef(0);
  const drag = useRef<{on: boolean; x: number; a: number}>({on: false, x: 0, a: 0});
  tgt.current = target;
  cb.current = arrive;

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d")!,
      dpr = Math.min(2, devicePixelRatio || 1),
      reduce = reduceProp ?? matchMedia("(prefers-reduced-motion:reduce)").matches;
    const zs = ZONES.map((z) => ({id: z.id, name: z.name.replace(/ Craft Zone$/, "").replace(/ Phase 1$/, ""), lat: rad(z.y * 20), lng: rad(z.x * 30)}));
    // background starfield dots (static)
    const dots = Array.from({length: 180}, () => ({lat: (Math.random() - 0.5) * Math.PI, lng: Math.random() * TAU}));
    let W = 0, H = 0;
    const fit = () => {
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);

    let last = performance.now(), raf = 0, t0 = 0, a0 = 0, fired = false;
    const P0 = 0.38;
    const proj = (lat: number, lng: number, A: number, P: number) => {
      const x = Math.cos(lat) * Math.sin(lng),
        y = Math.sin(lat),
        z = Math.cos(lat) * Math.cos(lng),
        x1 = x * Math.cos(A) - z * Math.sin(A),
        z1 = x * Math.sin(A) + z * Math.cos(A);
      return [x1, y * Math.cos(P) - z1 * Math.sin(P), y * Math.sin(P) + z1 * Math.cos(P)] as const;
    };

    const onDown = (e: PointerEvent) => {
      drag.current = {on: true, x: e.clientX, a: spinRef.current};
      c.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x;
      spinRef.current = drag.current.a + dx * 0.008;
    };
    const onUp = () => {
      drag.current.on = false;
    };
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);

    const frame = (now: number) => {
      last = now;
      const id = tgt.current,
        z = id ? zs.find((q) => q.id === id) : null;
      let A = spinRef.current,
        P = P0,
        zoom = 1,
        p = 0;
      if (z) {
        if (!t0) {
          t0 = now;
          a0 = spinRef.current % TAU;
        }
        p = Math.min(1, (now - t0) / (reduce ? 1 : DUR));
        const e = ease(Math.min(1, p * 1.35)),
          d = ((((z.lng - a0 + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        A = a0 + d * e;
        P = P0 + (z.lat - P0) * e;
        zoom = 1 + 11 * p * p * p;
        if (p >= 1 && !fired) {
          fired = true;
          cb.current();
        }
      }
      // NO auto-spin when idle — spinRef only changes via user drag
      const R = Math.min(W, H) * 0.36 * zoom,
        cx = W / 2,
        cy = H * 0.48;
      g.clearRect(0, 0, W, H);
      const glow = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.35);
      glow.addColorStop(0, "rgba(0,163,255,.16)");
      glow.addColorStop(1, "transparent");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(13,14,17,.9)";
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(36,41,54,1)";
      g.lineWidth = 1;
      g.stroke();
      const s = Math.max(1, 1.2 * Math.min(zoom, 3));
      for (const d of dots) {
        const v = proj(d.lat, d.lng, A, P);
        if (v[2] <= 0) continue;
        g.fillStyle = `rgba(120,200,255,${0.12 + 0.5 * v[2]})`;
        g.fillRect(cx + v[0] * R - s / 2, cy - v[1] * R - s / 2, s, s);
      }
      g.font = "10px ui-monospace, monospace";
      g.textAlign = "center";
      for (const q of zs) {
        const v = proj(q.lat, q.lng, A, P);
        if (v[2] <= 0.05) continue;
        const on = q.id === id,
          x = cx + v[0] * R,
          y = cy - v[1] * R;
        g.strokeStyle = on ? "#00FF66" : "#00A3FF";
        g.lineWidth = on ? 2 : 1;
        g.beginPath();
        g.arc(x, y, (on ? 7 : 4) * Math.min(zoom, 2), 0, TAU);
        g.stroke();
        g.fillStyle = g.strokeStyle as string;
        g.fillRect(x - 1.5, y - 1.5, 3, 3);
        // subtle name tag
        if (v[2] > 0.35 && zoom < 3) {
          g.fillStyle = on ? "rgba(0,255,102,.9)" : "rgba(180,200,220,.65)";
          g.fillText(q.name, x, y + 14);
        }
      }
      if (p > 0.55) {
        g.fillStyle = `rgba(13,14,17,${Math.min(1, (p - 0.55) / 0.45)})`;
        g.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, [/* stable */]);

  return (
    <canvas
      ref={cv}
      role="img"
      aria-label="Interactive globe — drag to rotate"
      className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing touch-none"
    />
  );
}
