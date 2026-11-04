"use client";
// Real activity from real approved orders: how many passes went in the last day and when the latest one was booked.
// It stays hidden until the numbers are worth showing, so it never looks empty or invented.
import { useEffect, useState } from "react";

interface Pulse { passes24h: number; lastMinutes: number | null }

export function SalesPulse() {
  const [p, setP] = useState<Pulse | null>(null);
  useEffect(() => {
    fetch("/api/event").then((r) => r.json()).then((j) => { if (j?.data?.pulse) setP(j.data.pulse); }).catch(() => { /* optional */ });
  }, []);
  if (!p || p.passes24h < 3) return null;
  const m = p.lastMinutes;
  const ago = m === null ? null : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 360 ? `${Math.floor(m / 60)} h ago` : null;
  return (
    <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-line px-4 py-2.5 text-[15px]" role="status">
      <span className="pulse-dot size-2 rounded-full bg-crimson" aria-hidden="true" />
      <span><strong className="tnum font-semibold">{p.passes24h}</strong> passes booked in the last 24 hours</span>
      {ago && <span className="muted">· Latest {ago}</span>}
    </p>
  );
}
