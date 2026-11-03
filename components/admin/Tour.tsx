"use client";
// A guided tour over the real admin screens. A dimmed layer leaves one hole around the thing being explained; a card says
// what it is. Click steps only move on when the admin taps the highlighted tab, so the tour teaches by doing.
// Nothing here writes data. Esc leaves; the arrow keys move between steps.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TourStep } from "./tour-steps";

interface Box { top: number; left: number; width: number; height: number }
const PAD = 6;

/** The first on-screen element with this tour name. The phone and desktop layouts both exist, so one is usually hidden. */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function Tour({ steps, start, tab, setTab, onClose }: {
  steps: TourStep[]; start: number; tab: string; setTab: (t: string) => void; onClose: (finished: boolean) => void;
}) {
  const [i, setI] = useState(start);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [cardH, setCardH] = useState(180);
  const card = useRef<HTMLDivElement>(null);
  const s = steps[i];
  const last = i === steps.length - 1;
  const tabNow = useRef(tab);
  useEffect(() => { tabNow.current = tab; }, [tab]);

  const go = (d: number) => setI((n) => Math.min(steps.length - 1, Math.max(0, n + d)));

  // Show the tab this step needs, then wait for its target to appear.
  useEffect(() => {
    setEl(null); setBox(null); setMissing(false);
    if (s.tab && s.tab !== tabNow.current) setTab(s.tab);
    if (!s.target) return;
    let tries = 0;
    const t = setInterval(() => {
      const found = findTarget(s.target!);
      if (found) { clearInterval(t); found.scrollIntoView({ block: "center", behavior: "auto" }); setEl(found); }
      else if (++tries > 14) { clearInterval(t); setMissing(true); }
    }, 100);
    return () => clearInterval(t);
    // Only a step change restarts the search: the parent re-creates `steps` and `setTab` on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Follow the target as the page scrolls or resizes.
  useEffect(() => {
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height ? b : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    read();
    const t = setInterval(read, 100);
    window.addEventListener("resize", read);
    return () => { clearInterval(t); window.removeEventListener("resize", read); };
  }, [el]);

  // Click steps: move on when the highlighted tab is tapped.
  useEffect(() => {
    if (!el || !s.click) return;
    const onTap = () => setTimeout(() => (i === steps.length - 1 ? onClose(true) : setI((n) => n + 1)), 160);
    el.addEventListener("click", onTap, true);
    return () => el.removeEventListener("click", onTap, true);
  }, [el, s, i, steps.length, onClose]);

  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose(false);
      else if (ev.key === "ArrowRight" && !(s.click && el)) { if (last) onClose(true); else go(1); }
      else if (ev.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (card.current && card.current.offsetHeight !== cardH) setCardH(card.current.offsetHeight); });
  useEffect(() => { card.current?.focus({ preventScroll: true }); }, [i]);

  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const hole = box && !missing ? {
    top: Math.max(0, box.top - PAD), left: Math.max(0, box.left - PAD),
    w: Math.min(vw, box.width + PAD * 2), h: Math.min(vh, box.height + PAD * 2),
  } : null;
  const waiting = !!s.target && !box && !missing; // looking for the target
  const W = Math.min(400, vw - 24);
  let top: number, left: number;
  if (!hole) { top = Math.max(12, (vh - cardH) / 2); left = (vw - W) / 2; }
  else {
    const below = vh - (hole.top + hole.h);
    if (below >= cardH + 16) top = hole.top + hole.h + 12;
    else if (hole.top >= cardH + 16) top = hole.top - cardH - 12;
    else top = vh - cardH - 12;
    left = Math.min(Math.max(hole.left, 12), vw - W - 12);
  }
  const mustTap = !!s.click && !!hole;
  const text = missing && s.fallback ? s.fallback : s.text;
  const dim = "fixed z-[60] bg-bg/80";

  return (
    <>
      {hole ? (
        <>
          <div className={dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className={dim} style={{ top: hole.top + hole.h, left: 0, right: 0, bottom: 0 }} />
          <div className={dim} style={{ top: hole.top, left: 0, width: hole.left, height: hole.h }} />
          <div className={dim} style={{ top: hole.top, left: hole.left + hole.w, right: 0, height: hole.h }} />
          {!mustTap && <div className="fixed z-[60]" style={{ top: hole.top, left: hole.left, width: hole.w, height: hole.h }} />}
          <div className="tour-ring" style={{ top: hole.top, left: hole.left, width: hole.w, height: hole.h }} aria-hidden="true" />
        </>
      ) : <div className={`${dim} inset-0`} />}

      <div ref={card} tabIndex={-1} role="dialog" aria-label={`Tour step ${i + 1} of ${steps.length}: ${s.title}`} key={i}
        className="tour-card fixed z-[62] rounded-sm border border-line-strong bg-bg p-5 text-fg outline-none" style={{ top, left, width: W }}>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="label">Step {i + 1} of {steps.length}</span>
          <button className="inline-flex min-h-11 items-center rounded-sm border border-line-strong px-3 font-semibold hover:bg-[var(--selected)]" onClick={() => onClose(false)}>Skip tour</button>
        </div>
        <div className="mt-1 h-1 rounded-sm bg-line" aria-hidden="true"><div className="tour-bar h-full rounded-sm bg-crimson" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        <h2 className="mt-3 text-lg leading-snug">{s.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed">{waiting ? "Finding it…" : text}</p>
        {mustTap && <p className="tour-tap mt-3 text-sm font-semibold text-crimson">Tap the highlighted tab to continue.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-quiet btn-calm min-h-11 px-4 text-sm" onClick={() => go(-1)} disabled={i === 0}>Back</button>
          {mustTap
            ? <button className="muted inline-flex min-h-11 items-center px-2 text-sm hover:text-fg" onClick={() => go(1)}>Skip this step</button>
            : <button className="btn btn-primary btn-calm ml-auto min-h-11 px-6 text-sm" onClick={() => (last ? onClose(true) : go(1))} disabled={waiting}>{last ? "Finish" : "Next"}</button>}
        </div>
      </div>
    </>
  );
}
