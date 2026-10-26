"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { TicketCard } from "@/components/TicketCard";
import { paise } from "@/lib/normalize";

interface T { token: string; shortCode: string; admits: number; passName: string; holderName: string; status: string }
interface S { status: "pending" | "paid" | "expired" | "needs_refund" | "refunded"; amountPaise: number; tickets: T[]; checkingWithGateway: boolean }

/** Polls the server. Never decides anything itself: a ticket shows only once the server says `paid`. */
export function OrderStatus({ orderId, whatsapp }: { orderId: string; whatsapp: string | null }) {
  const [s, setS] = useState<S | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const started = useRef(Date.now());
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (r.status === 404) { setMissing(true); return; }
        const j = await r.json();
        if (j.ok) { setS(j.data); setOffline(false); if (j.data.status !== "pending") return; }
      } catch { setOffline(true); }
      setWaited(Math.round((Date.now() - started.current) / 1000));
      if (!stop) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [orderId]);

  const help = whatsapp ? <a href={whatsapp} className="border-b border-blood text-fg">WhatsApp us</a> : <>WhatsApp {e.organiser.whatsapp}</>;

  if (missing) {
    return <Notice title="We can't find that order.">Check the link, or <Link href="/find-ticket" className="border-b border-blood text-fg">find your ticket</Link> using your email or phone.</Notice>;
  }
  if (!s) return <div className="mt-8 space-y-4" aria-busy="true"><div className="skeleton h-28" /><div className="skeleton h-72" /></div>;

  if (s.status === "paid") {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          <svg className="check-draw pop size-9 shrink-0 text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10.5" strokeWidth="1.2" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
          <div>
            <h1 className="text-[22px] leading-tight">Payment confirmed</h1>
            <p className="muted text-sm">{paise(s.amountPaise)} · A copy is on its way to your email.</p>
          </div>
        </div>
        {s.tickets.map((t, i) => <TicketCard key={t.token} t={{ ...t, status: t.status as "valid" }} delay={i + 1} />)}
        <p className="muted text-center text-sm">Screenshot this page. If the QR won&apos;t scan, read your short code to the volunteer. Your name and ID will be checked at the door.</p>
        <div className="flex gap-3">
          {s.tickets[0] && <Link href={`/t/${s.tickets[0].token}`} className="btn btn-calm btn-quiet min-h-12 flex-1">Open ticket page</Link>}
          {whatsapp && <a href={whatsapp} className="btn btn-calm btn-quiet min-h-12 flex-1">WhatsApp help</a>}
        </div>
      </div>
    );
  }

  if (s.status === "expired") {
    return (
      <Notice title="Your hold on these passes ended.">
        If you completed a payment, we&apos;ll confirm it automatically, or refund it in full if the passes sold out. Check this page again in a minute, or {help} with your phone number. Otherwise,{" "}
        <Link href="/#passes" className="border-b border-blood text-fg">pick passes again</Link>.
      </Notice>
    );
  }
  if (s.status === "needs_refund") {
    return <Notice title="Your payment arrived after the passes sold out.">You will be refunded in full to your original payment method, and we&apos;ve emailed you. Questions? {help}.</Notice>;
  }
  if (s.status === "refunded") {
    return <Notice title="This order was refunded.">The tickets on it no longer work. Refunds typically reach your account in 5 to 7 business days.</Notice>;
  }

  return (
    <div role="status" aria-live="polite" className="card-plain slide-up mt-8 p-6">
      <div className="flex items-center gap-3">
        <span className="btn-spinner size-5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-crimson" aria-hidden="true" />
        <h1 className="text-xl">Confirming your payment…</h1>
      </div>
      <p className="muted mt-3 text-sm">
        Keep this page open. Your ticket appears here only after the payment is verified, never before. If you close the page, we still email it.
      </p>
      {s.checkingWithGateway && <p className="mt-3 text-sm">Taking longer than usual, so we&apos;re checking with the payment provider directly.</p>}
      {offline && <p className="mt-3 text-sm text-danger">You seem to be offline. Reconnecting…</p>}
      {waited > 90 && <p className="muted mt-3 text-sm">Still nothing after a couple of minutes? {help} with your phone number and payment screenshot. If you were charged, you get a ticket or a refund.</p>}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="card-plain slide-up mt-8 p-6">
      <h1 className="text-xl">{title}</h1>
      <p className="muted mt-3 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
