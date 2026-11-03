"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { TicketCard } from "@/components/TicketCard";
import { PaymentProof } from "@/components/PaymentProof";
import { rememberOrder } from "@/lib/myOrders";
import { paise } from "@/lib/normalize";
import { HelpWhatsApp } from "./HelpWhatsApp";

interface T { token: string; shortCode: string; admits: number; passName: string; holderName: string; status: string }
interface S { emailMasked: string; status: "pending" | "awaiting_review" | "rejected" | "paid" | "expired" | "needs_refund" | "refunded"; amountPaise: number; expiresAt: string; reviewNote: string | null; tickets: T[] }

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

  const help = whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="border-b border-blood text-fg">WhatsApp us</a> : <>WhatsApp {e.organiser.whatsapp}</>;

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
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-calm btn-quiet min-h-12 flex-1">WhatsApp help</a>}
        </div>
      </div>
    );
  }

  if (s.status === "expired") {
    return (
      <>
        <Notice title="Your hold on these passes ended.">
          Already paid? Tell us below with your UTR and we&apos;ll sort it out. Otherwise,{" "}
          <Link href="/#passes" className="border-b border-blood text-fg">pick passes again</Link>.
        </Notice>
        <HelpWhatsApp orderId={orderId} amountPaise={s.amountPaise} />
      </>
    );
  }
  if (s.status === "needs_refund") {
    return s.reviewNote
      ? <Notice title="We couldn&apos;t offer you a ticket.">{s.reviewNote}. Your payment of {paise(s.amountPaise)} will be refunded in full to the account you paid from, and we&apos;ve emailed you. Questions? {help}.</Notice>
      : <Notice title="These passes sold out before we could confirm your payment.">You will be refunded in full to the account you paid from, and we&apos;ve emailed you. Questions? {help}.</Notice>;
  }
  if (s.status === "refunded") {
    return <Notice title="Your refund has been sent.">{paise(s.amountPaise)} was sent back to the account you paid from. Banks can take a short while to show it. Questions? {help}.</Notice>;
  }

  if (s.status === "rejected") {
    return <Notice title="We couldn&apos;t confirm this payment.">{s.reviewNote ? <>{s.reviewNote}. </> : null}This order is closed. If you were charged, {help} with your UTR. Otherwise <Link href="/#passes" className="border-b border-blood text-fg">pick passes again</Link>.</Notice>;
  }

  if (s.status === "awaiting_review") {
    const ref = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const steps: [string, string, "done" | "now" | "next"][] = [
      ["Payment details submitted", "We have your UTR and screenshot.", "done"],
      ["We verify your payment", "Checked by hand against our bank account.", "now"],
      ["Ticket sent to you", "A PDF by email, and on this page. We may also WhatsApp it.", "next"],
    ];
    return (
      <div role="status" aria-live="polite" className="slide-up mt-8">
        <svg className="check-draw pop size-12 text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10.5" strokeWidth="1.2" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
        <p className="eyebrow mt-4">Order received</p>
        <h1 className="mt-2 text-[26px] leading-tight">Your ticket is being processed.</h1>
        <p className="mt-2 text-[17px] leading-snug">Don&apos;t worry, nothing more is needed from you. We&apos;re checking your payment now and will email your ticket{s.emailMasked ? <> to <strong className="tnum">{s.emailMasked}</strong></> : null} as soon as it&apos;s confirmed.</p>
        <p className="muted mt-2 text-sm">You can close this page. If something looks wrong with your payment, we&apos;ll email you and show it here.</p>
        <ol className="card mt-6 divide-y divide-line">
          {steps.map(([t, d, st], i) => (
            <li key={t} className="flex gap-3 p-4">
              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${st === "done" ? "border-fg bg-fg text-bg" : st === "now" ? "border-crimson text-crimson" : "border-line-strong text-fg-muted"}`} aria-hidden="true">{st === "done" ? "✓" : i + 1}</span>
              <span>
                <span className={`block font-medium ${st === "next" ? "muted" : ""}`}>{t}{st === "now" && <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-crimson">In progress</span>}</span>
                <span className="muted block text-sm">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="muted mt-4 text-sm">Order reference <span className="tnum text-fg">{ref}</span> · {paise(s.amountPaise)}</p>
        {offline && <p className="mt-3 text-sm text-danger">You seem to be offline. Reconnecting…</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/find-ticket" className="btn btn-calm btn-quiet min-h-12 flex-1">My tickets</Link>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-calm btn-quiet min-h-12 flex-1">Taking long? WhatsApp us</a> : <p className="muted self-center text-sm">Taking long? WhatsApp {e.organiser.whatsapp}</p>}
        </div>
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
