"use client";
// A real countdown to doors opening (12:00 noon IST, 15 Nov 2026). It only ever counts to the true start, never to an invented deadline.
import { useEffect, useState } from "react";

export const DOORS_OPEN = Date.parse("2026-11-15T06:30:00Z"); // 12:00 IST

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");

export function Countdown({ compact = false, label = "Doors open in" }: { compact?: boolean; label?: string }) {
  const [now, setNow] = useState<number | null>(null); // null until mounted: the server HTML never shows a stale time
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = now === null ? null : DOORS_OPEN - now;
  const t = left === null ? null : parts(left);
  const units: [string, string][] = t
    ? [[String(t.d), "days"], [two(t.h), "hrs"], [two(t.m), "min"], [two(t.s), "sec"]]
    : [["--", "days"], ["--", "hrs"], ["--", "min"], ["--", "sec"]];

  if (left !== null && left <= 0) {
    return <p className="text-sm font-semibold uppercase tracking-[0.2em] text-crimson">Doors are open</p>;
  }
  return (
    <div role="timer" aria-label={t ? `${label} ${t.d} days ${t.h} hours ${t.m} minutes` : label}>
      <p className="label">{label}</p>
      <p className={`countdown tnum mt-2 flex items-end gap-3 sm:gap-4 ${compact ? "text-2xl" : "text-4xl sm:text-5xl"}`} aria-hidden="true">
        {units.map(([v, u], i) => (
          <span key={u} className="flex items-end gap-3 sm:gap-4">
            <span className="flex flex-col items-start leading-none">
              <span className="countdown-num">{v}</span>
              <span className="mt-1.5 text-[11px] font-normal uppercase tracking-[0.2em] text-muted">{u}</span>
            </span>
            {i < 3 && <span className="countdown-sep pb-5 text-crimson" aria-hidden="true">:</span>}
          </span>
        ))}
      </p>
    </div>
  );
}
