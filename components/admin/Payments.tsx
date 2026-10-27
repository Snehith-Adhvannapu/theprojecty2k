"use client";
// Payment verification queue. Approve only after the UTR AND the amount match the bank statement.
import { useCallback, useEffect, useState } from "react";
import { paise } from "@/lib/normalize";
import { formatFullIST } from "@/lib/time";
import { api } from "./api";

interface Row {
  id: string; status: string; buyerName: string; buyerPhone: string; buyerEmail: string; items: string;
  amountPaise: number; utr: string | null; submittedAt: string | null; reviewNote: string | null; hasProof: boolean; ticketToken: string | null;
}
interface Queue { pending: Row[]; reviewed: Row[] }

const wa = (phone: string, name: string, token: string) => {
  const url = `${window.location.origin}/t/${token}`;
  const text = `Hi ${name}, your Project Y2K ticket is confirmed. Open it here (QR + PDF): ${url}`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
};

export function Payments() {
  const [q, setQ] = useState<Queue | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setQ(await api<Queue>("/api/admin/payments")); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  if (err && !q) return <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>;
  if (!q) return <div className="skeleton h-64" aria-busy="true" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">To verify <span className="muted tnum">({q.pending.length})</span></h2>
        <button className="muted inline-flex min-h-11 items-center text-sm hover:text-fg" onClick={load}>Refresh</button>
      </div>
      {q.pending.length === 0 && <p className="card-plain muted p-5 text-sm">Nothing waiting. New payments show up here as soon as buyers submit their UTR.</p>}
      {q.pending.map((r) => <Pending key={r.id} r={r} done={load} />)}

      {q.reviewed.length > 0 && (
        <section className="mt-4">
          <h2 className="text-lg">Reviewed</h2>
          <ul className="card-plain mt-3 divide-y divide-line">
            {q.reviewed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{r.buyerName}</span>{" "}
                  <span className="muted tnum">· {paise(r.amountPaise)} · UTR {r.utr ?? "-"}</span>
                  {r.reviewNote && <span className="muted"> · {r.reviewNote}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className={r.status === "paid" ? "" : "text-crimson"}>{r.status === "paid" ? "Approved" : r.status === "needs_refund" ? "Refund needed" : "Rejected"}</span>
                  {r.ticketToken && <a className="inline-flex min-h-11 items-center border-b border-blood" href={wa(r.buyerPhone, r.buyerName, r.ticketToken)} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Pending({ r, done }: { r: Row; done: () => void }) {
  const [mode, setMode] = useState<"idle" | "confirm" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg("");
    try { await fn(); await done(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }
  const approve = () => run(async () => {
    const r2 = await api<{ result: string }>(`/api/admin/orders/${r.id}/approve`, {});
    if (r2.result === "needs_refund") throw new Error("Passes sold out in the meantime. Marked as needing a refund; refund this buyer.");
  });
  const reject = (resubmit: boolean) => run(() => api(`/api/admin/orders/${r.id}/reject`, { reason, resubmit }));

  return (
    <article className="card p-5" aria-label={`Payment from ${r.buyerName}`}>
      <div className="flex flex-col gap-5 sm:flex-row">
        {r.hasProof ? (
          <a href={`/api/admin/orders/${r.id}/proof`} target="_blank" rel="noreferrer" className="shrink-0 self-start" aria-label="Open the payment screenshot full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/orders/${r.id}/proof`} alt={`Payment screenshot from ${r.buyerName}`} className="h-48 w-36 rounded-sm border border-line object-cover object-top" loading="lazy" />
          </a>
        ) : <div className="muted flex h-48 w-36 items-center justify-center rounded-sm border border-line text-sm">No image</div>}
        <div className="min-w-0 flex-1">
          <p className="tnum text-[32px] font-semibold leading-none">{paise(r.amountPaise)}</p>
          <p className="mt-3 text-lg font-semibold">{r.buyerName}</p>
          <p className="muted text-sm">{r.items}</p>
          <p className="muted mt-1 text-sm">{r.buyerPhone} · {r.buyerEmail}</p>
          <p className="label mt-4">UTR</p>
          <p className="tnum select-all text-xl font-semibold tracking-wider">{r.utr}</p>
          {r.submittedAt && <p className="muted mt-1 text-[13px]">Submitted {formatFullIST(r.submittedAt)}</p>}
        </div>
      </div>

      {msg && <p role="alert" className="mt-4 rounded-sm border border-danger p-3 text-sm">{msg}</p>}

      {mode === "idle" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn btn-primary btn-calm min-h-12 flex-1 sm:flex-none sm:px-8" onClick={() => setMode("confirm")} disabled={busy}>Approve</button>
          <button className="btn btn-quiet btn-calm min-h-12 flex-1 sm:flex-none sm:px-8" onClick={() => setMode("reject")} disabled={busy}>Reject…</button>
        </div>
      )}
      {mode === "confirm" && (
        <div className="mt-5 rounded-sm border border-blood bg-[var(--selected)] p-4">
          <p className="text-sm">Approve only if your bank statement shows <strong className="tnum">{paise(r.amountPaise)}</strong> received with UTR <strong className="tnum">{r.utr}</strong>. This issues the ticket and emails the PDF.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="btn btn-primary btn-calm min-h-12 flex-1" onClick={approve} disabled={busy} aria-busy={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}{busy ? "Approving…" : "Yes, it matches. Approve"}
            </button>
            <button className="btn btn-quiet btn-calm min-h-12" onClick={() => setMode("idle")} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {mode === "reject" && (
        <div className="mt-5 flex flex-col gap-3">
          <label htmlFor={`rr-${r.id}`} className="text-sm font-medium">Reason (the buyer sees this)</label>
          <input id={`rr-${r.id}`} className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. UTR not found in our bank. Check the number." disabled={busy} />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary btn-calm min-h-12 flex-1" disabled={busy || reason.trim().length < 3} onClick={() => reject(true)}>Ask to resubmit</button>
            <button className="btn btn-quiet btn-calm min-h-12 flex-1" disabled={busy || reason.trim().length < 3} onClick={() => reject(false)}>Reject for good</button>
            <button className="btn btn-quiet btn-calm min-h-12" onClick={() => setMode("idle")} disabled={busy}>Back</button>
          </div>
        </div>
      )}
    </article>
  );
}
