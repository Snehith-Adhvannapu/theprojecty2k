"use client";
// Returning buyers: a bar under the header that says where their order stands, with one button to carry on.
// It reads the order ids this browser saved at checkout, then asks the server for the status only. Nothing personal is shown.
import Link from "next/link";
import { useEffect, useState } from "react";
import { savedOrders } from "@/lib/myOrders";

interface Row { id: string; status: string }
const COPY: Record<string, { text: string; cta: string }> = {
  pending: { text: "Your order is on hold for you.", cta: "Finish paying" },
  awaiting_review: { text: "We're checking your payment.", cta: "See status" },
  paid: { text: "You're on the list. Your ticket is ready.", cta: "Open ticket" },
  rejected: { text: "We couldn't confirm your payment.", cta: "See details" },
};
const RANK = ["pending", "awaiting_review", "paid", "rejected"]; // the order that needs the buyer most comes first
const SEEN = "y2k_welcome_back_dismissed";

export function WelcomeBack() {
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    try { if (sessionStorage.getItem(SEEN)) return; } catch { /* storage blocked: still fine to show */ }
    const ids = savedOrders().slice(0, 5);
    if (!ids.length) return;
    let live = true;
    Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`/api/orders/${id}/status`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        return j?.ok ? ({ id, status: j.data.status as string }) : null;
      } catch { return null; }
    })).then((x) => {
      if (!live) return;
      const best = x.filter((r): r is Row => !!r && r.status in COPY).sort((a, b) => RANK.indexOf(a.status) - RANK.indexOf(b.status))[0];
      if (best) setRow(best);
    });
    return () => { live = false; };
  }, []);
  if (!row) return null;
  const c = COPY[row.status];
  return (
    <div role="region" aria-label="Your order" className="welcome-rise border-b border-line bg-[var(--selected)]">
      <div className="wrap flex items-center justify-between gap-3 py-2">
        <p className="min-w-0 text-[15px] leading-snug"><span className="text-crimson">Welcome back.</span> {c.text}</p>
        <span className="flex shrink-0 items-center gap-1">
          <Link href={`/order/${row.id}`} className="btn btn-primary min-h-11 whitespace-nowrap px-4 text-xs sm:px-5">{c.cta}</Link>
          <button aria-label="Dismiss" className="inline-flex size-11 items-center justify-center text-muted hover:text-fg"
            onClick={() => { setRow(null); try { sessionStorage.setItem(SEEN, "1"); } catch { /* ignore */ } }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </span>
      </div>
    </div>
  );
}
