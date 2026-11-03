"use client";
// Refund tracker: who is owed money back, who has been paid back, how, and the totals.
import { useCallback, useEffect, useState } from "react";
import { paise } from "@/lib/normalize";
import { formatFullIST } from "@/lib/time";
import { api } from "./api";
import { Tip } from "@/components/Tip";

interface Row { orderId: string; name: string; phone: string; amountPaise: number; reason: string | null; at: string; method?: string; reference?: string | null; note?: string | null; by?: string | null }
interface Ledger { owed: Row[]; done: Row[]; totals: { owedCount: number; owedPaise: number; refundedCount: number; refundedPaise: number } }

const METHODS: [string, string][] = [["upi", "UPI app"], ["whatsapp", "Agreed on WhatsApp"], ["cash", "Cash"], ["other", "Other"]];
const methodLabel = (m?: string) => METHODS.find(([k]) => k === m)?.[1] ?? m ?? "";

const waOwed = (r: Row) => `https://wa.me/${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${r.name}, this is Project Y2K about your refund of ${paise(r.amountPaise)}. Please reply with your UPI ID or a screenshot of your UPI QR code, and we'll send it right away.`)}`;
const waSent = (r: Row) => `https://wa.me/${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${r.name}, your Project Y2K refund of ${paise(r.amountPaise)} has been sent. It can take a short while to show in your bank.`)}`;

export function Refunds() {
  const [l, setL] = useState<Ledger | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setL(await api<Ledger>("/api/admin/refunds")); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } }, []);
  useEffect(() => { load(); }, [load]);
  if (err && !l) return <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>;
  if (!l) return <div className="skeleton h-64" aria-busy="true" />;
  const t = l.totals;
  const dl = "btn btn-quiet btn-calm min-h-11 px-4 text-sm";
  return (
    <section className="flex flex-col gap-5">
      <div data-tour="rf-stats" className="flex flex-wrap gap-3">
        <div className="card-plain relative min-w-[160px] flex-1 px-5 py-4"><span className="absolute right-3.5 top-3.5"><Tip text="Total money that buyers paid but who won't get a ticket. Send it back, then mark it refunded." /></span><p className="label pr-6">Still to refund</p><p className="tnum mt-1.5 text-[32px] font-semibold">{paise(t.owedPaise)}</p><p className="muted text-[13px]">{t.owedCount} {t.owedCount === 1 ? "person" : "people"}</p></div>
        <div className="card-plain relative min-w-[160px] flex-1 px-5 py-4"><span className="absolute right-3.5 top-3.5"><Tip text="Money you have already sent back and recorded here." /></span><p className="label pr-6">Refunded so far</p><p className="tnum mt-1.5 text-[32px] font-semibold">{paise(t.refundedPaise)}</p><p className="muted text-[13px]">{t.refundedCount} {t.refundedCount === 1 ? "person" : "people"}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a className={dl} href="/api/admin/export?kind=refunds&format=xlsx">Export Excel (.xlsx)</a>
        <a className={dl} href="/api/admin/export?kind=refunds&format=csv">Export CSV</a>
        <button className="muted inline-flex min-h-11 items-center text-sm hover:text-fg" onClick={load}>Refresh</button>
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 text-lg">To refund ({t.owedCount})<Tip text="Ask for their UPI ID on WhatsApp, send the money from your UPI app, then press Mark as refunded so the totals stay correct." /></h2>
        <p className="muted mt-1 text-sm">Send the money back from your UPI app, or settle it over WhatsApp, then record it here so the count stays right.</p>
        {l.owed.length === 0 ? <p className="card-plain muted mt-3 p-5 text-sm">Nobody is waiting for a refund.</p> : (
          <ul className="mt-3 flex flex-col gap-3">{l.owed.map((r) => <Owed key={r.orderId} r={r} done={load} />)}</ul>
        )}
      </div>

      <div>
        <h2 className="flex items-center gap-1.5 text-lg">Refunded ({t.refundedCount})<Tip text="A record of every refund: who, how much, how it was sent and who recorded it." /></h2>
        {l.done.length === 0 ? <p className="card-plain muted mt-3 p-5 text-sm">No refunds recorded yet.</p> : (
          <ul className="card-plain mt-3 divide-y divide-line">
            {l.done.map((r) => (
              <li key={r.orderId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span> <span className="muted tnum">· {paise(r.amountPaise)} · {methodLabel(r.method)}{r.reference ? ` · ref ${r.reference}` : ""}</span>
                  <span className="muted block text-[13px]">{formatFullIST(r.at)}{r.by ? ` · by ${r.by}` : ""}{r.note ? ` · ${r.note}` : ""}</span>
                </span>
                <a className="inline-flex min-h-11 items-center border-b border-blood" href={waSent(r)} target="_blank" rel="noopener noreferrer">Tell them on WhatsApp</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Owed({ r, done }: { r: Row; done: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ method: "upi", reference: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() {
    setBusy(true); setMsg("");
    try { await api(`/api/admin/orders/${r.orderId}/refunded`, { method: f.method, reference: f.reference || undefined, note: f.note || undefined }); await done(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }
  return (
    <li className="card-plain p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base font-semibold">{r.name} <span className="muted tnum text-sm font-normal">· {r.phone}</span></p>
        <p className="tnum text-xl font-semibold">{paise(r.amountPaise)}</p>
      </div>
      <p className="muted text-[13px]">{r.reason ? `${r.reason} · ` : "Passes sold out · "}{formatFullIST(r.at)}</p>
      {msg && <p role="alert" className="mt-3 rounded-sm border border-danger p-3 text-sm">{msg}</p>}
      {!open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn btn-quiet btn-calm min-h-11 flex-1 px-4 text-sm sm:flex-none" href={`tel:${r.phone}`}>Call</a>
          <a className="btn btn-quiet btn-calm min-h-11 flex-1 px-4 text-sm sm:flex-none" href={waOwed(r)} target="_blank" rel="noopener noreferrer">Ask for UPI ID / QR</a>
          <button className="btn btn-primary btn-calm min-h-11 basis-full px-5 text-sm sm:basis-auto" onClick={() => setOpen(true)}>Mark as refunded</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 rounded-sm border border-line-strong p-4">
          <p className="text-sm">Confirm you have sent <strong className="tnum">{paise(r.amountPaise)}</strong> back to {r.name}.</p>
          <label className="label" htmlFor={`m-${r.orderId}`}>How</label>
          <select id={`m-${r.orderId}`} className="field" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="label" htmlFor={`r-${r.orderId}`}>Reference (UPI transaction ID, optional)</label>
          <input id={`r-${r.orderId}`} className="field" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} maxLength={80} />
          <label className="label" htmlFor={`n-${r.orderId}`}>Note (optional)</label>
          <input id={`n-${r.orderId}`} className="field" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} placeholder="e.g. sent to their other UPI ID" />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary btn-calm min-h-12 flex-1" onClick={save} disabled={busy} aria-busy={busy}>{busy && <span className="spinner" aria-hidden="true" />}{busy ? "Saving…" : "Yes, it's refunded"}</button>
            <button className="btn btn-quiet btn-calm min-h-12" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          </div>
          <p className="muted text-[13px]">The buyer is also emailed that the refund was sent.</p>
        </div>
      )}
    </li>
  );
}
