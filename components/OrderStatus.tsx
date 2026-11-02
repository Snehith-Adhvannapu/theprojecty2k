"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { TicketCard } from "@/components/TicketCard";
import { PaymentProof } from "@/components/PaymentProof";
import { rememberOrder } from "@/lib/myOrders";
import { paise } from "@/lib/normalize";

interface T { token: string; shortCode: string; admits: number; passName: string; holderName: string; status: string }
interface S { status: "pending" | "awaiting_review" | "rejected" | "paid" | "expired" | "needs_refund" | "refunded"; amountPaise: number; expiresAt: string; reviewNote: string | null; tickets: T[] }

/** Polls the server. Never decides anything itself: a ticket shows only once the server says `paid`. */
export function OrderStatus({ orderId, whatsapp }: { orderId: string; whatsapp: string | null }) {
  const [s, setS] = useState<S | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (r.status === 404) { setMissing(true); return; }
        const j = await r.json();
        if (j.ok) { rememberOrder(orderId); setS(j.data); setOffline(false); if (j.data.status !== "pending" && j.data.status !== "awaiting_review") return; }
      } catch { setOffline(true); }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [orderId, refresh]);

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
          {s.tickets[0] && <a href={`/api/tickets/${s.tickets[0].token}/pdf`} className="btn btn-calm btn-quiet min-h-12 flex-1">Download PDF</a>}
          {whatsapp && <a href={whatsapp} className="btn btn-calm btn-quiet min-h-12 flex-1">WhatsApp help</a>}
        </div>
      </div>
    );
  }

  if (s.status === "expired") {
    return (
      <Notice title="Your hold on these passes ended.">
        Already paid? {help} with your UTR and phone number and we&apos;ll sort it out. Otherwise,{" "}
        <Link href="/#passes" className="border-b border-blood text-fg">pick passes again</Link>.
      </Notice>
    );
  }
  if (s.status === "needs_refund") {
    return <Notice title="These passes sold out before we could confirm your payment.">You will be refunded in full to the account you paid from, and we&apos;ve emailed you. Questions? {help}.</Notice>;
  }
  if (s.status === "refunded") {
    return <Notice title="This order was refunded.">The tickets on it no longer work. </Notice>;
  }

  if (s.status === "rejected") {
    return <Notice title="We couldn&apos;t confirm this payment.">{s.reviewNote ? <>{s.reviewNote}. </> : null}This order is closed. If you were charged, {help} with your UTR. Otherwise <Link href="/#passes" className="border-b border-blood text-fg">pick passes again</Link>.</Notice>;
  }

  if (s.status === "awaiting_review") {
    return (
      <div role="status" aria-live="polite" className="card-plain slide-up mt-8 p-6">
        <div className="flex items-center gap-3">
          <span className="btn-spinner size-5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-crimson" aria-hidden="true" />
          <h1 className="text-xl">We&apos;re verifying your payment</h1>
        </div>
        <p className="muted mt-3 text-sm leading-relaxed">
          Thanks. We check every payment against our bank account by hand. Your ticket appears on this page and is emailed to you as a PDF once it&apos;s confirmed. You can close this page.
        </p>
        {offline && <p className="mt-3 text-sm text-danger">You seem to be offline. Reconnecting…</p>}
        <p className="muted mt-3 text-sm">Taking long? {help} with your phone number.</p>
      </div>
    );
  }

  return <PaymentProof orderId={orderId} amountPaise={s.amountPaise} expiresAt={s.expiresAt} note={s.reviewNote} onSubmitted={() => setRefresh((n) => n + 1)} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="card-plain slide-up mt-8 p-6">
      <h1 className="text-xl">{title}</h1>
      <p className="muted mt-3 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
