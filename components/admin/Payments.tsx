"use client";
// Payment verification queue. Approve only after the UTR AND the amount match the bank statement.
import { useCallback, useEffect, useState } from "react";
import { paise } from "@/lib/normalize";
import { formatFullIST } from "@/lib/time";
import { api } from "./api";
import { fillWa, WA_DEFAULTS, WA_KINDS, WA_LABEL, WA_PLACEHOLDERS, type WaKind, type WaTemplates } from "@/lib/wa-fill";

interface Row {
  id: string; status: string; buyerName: string; buyerPhone: string; buyerEmail: string; items: string;
  amountPaise: number; utr: string | null; submittedAt: string | null; reviewNote: string | null; hasProof: boolean; ticketToken: string | null; canReverse: boolean;
}
interface Queue { pending: Row[]; reviewed: Row[] }

const wa = (phone: string, name: string, token: string) => {
  const url = `${window.location.origin}/t/${token}`;
  const text = `Hi ${name}, your Project Y2K ticket is confirmed. Open it here (QR + PDF): ${url}`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
};

/** The text of a rejection message for one buyer, from a template (placeholders filled in). */
const waText = (t: string, r: Row, reason: string) =>
  fillWa(t, { name: r.buyerName, amount: paise(r.amountPaise), reason: reason || "we could not match it to our bank record", link: `${window.location.origin}/order/${r.id}`, order: r.id.slice(0, 8).toUpperCase() });
const waTo = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
/** Which preset a past decision used. */
const kindOf = (r: Row): WaKind => (r.status === "needs_refund" ? "refund" : r.status === "rejected" ? "reject" : "fix");

/** WhatsApp message asking the buyer to confirm a payment (used before deciding, and when reconsidering a rejection). */
const waConfirm = (phone: string, name: string, amountPaise: number, utr: string | null) => {
  const text = `Hi ${name}, this is Project Y2K about your payment of ${paise(amountPaise)}${utr ? ` (UTR ending ${utr.slice(-4)})` : ""}. Could you confirm you've paid and send a clear screenshot of the payment?`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
};

/** Call + WhatsApp buttons so the admin can confirm with the buyer before deciding. */
function Contact({ r }: { r: Row }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a className="btn btn-quiet btn-calm min-h-11 flex-1 sm:flex-none sm:px-5" href={`tel:${r.buyerPhone}`}>Call buyer</a>
      <a className="btn btn-quiet btn-calm min-h-11 flex-1 sm:flex-none sm:px-5" href={waConfirm(r.buyerPhone, r.buyerName, r.amountPaise, r.utr)} target="_blank" rel="noreferrer">WhatsApp to confirm</a>
    </div>
  );
}

const REASONS = [
  "We couldn't find this payment in our bank account",
  "The UTR doesn't match our bank record",
  "The amount doesn't match the pass price",
  "The screenshot is unclear or incomplete",
];

export function Payments({ focusOrder }: { focusOrder?: string }) {
  const [q, setQ] = useState<Queue | null>(null);
  const [err, setErr] = useState("");
  const [tpls, setTpls] = useState<WaTemplates>(WA_DEFAULTS);
  useEffect(() => { fetch("/api/admin/templates", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j?.ok) setTpls(j.data); }).catch(() => {}); }, []);
  const load = useCallback(async () => {
    try { setQ(await api<Queue>("/api/admin/payments")); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  // Deep link from the alert email: scroll to and highlight that payment once it renders.
  const loaded = q !== null;
  useEffect(() => {
    if (!loaded || !focusOrder) return;
    document.getElementById(`pay-${focusOrder}`)?.scrollIntoView({ block: "center" });
  }, [loaded, focusOrder]);

  if (err && !q) return <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>;
  if (!q) return <div className="skeleton h-64" aria-busy="true" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">To verify <span className="muted tnum">({q.pending.length})</span></h2>
        <button className="muted inline-flex min-h-11 items-center text-sm hover:text-fg" onClick={load}>Refresh</button>
      </div>
      {q.pending.length === 0 && <p className="card-plain muted p-5 text-sm">Nothing waiting. New payments show up here as soon as buyers submit their UTR.</p>}
      {q.pending.map((r) => <Pending key={r.id} r={r} done={load} focus={r.id === focusOrder} tpls={tpls} onSaved={setTpls} />)}

      {q.reviewed.length > 0 && (
        <section className="mt-4">
          <h2 className="text-lg">Reviewed</h2>
          <ul className="card-plain mt-3 divide-y divide-line">
            {q.reviewed.map((r) => (
              <li key={r.id} id={`pay-${r.id}`} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm ${r.id === focusOrder ? "bg-[var(--selected)]" : ""}`}>
                <span>
                  <span className="font-medium">{r.buyerName}</span>{" "}
                  <span className="muted tnum">· {paise(r.amountPaise)} · UTR {r.utr ?? "-"}</span>
                  {r.reviewNote && <span className="muted"> · {r.reviewNote}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-0">
                  <span className={r.status === "paid" ? "" : "text-crimson"}>{r.status === "paid" ? "Approved" : r.status === "needs_refund" ? "Refund owed" : "Rejected"}</span>
                  {r.ticketToken && <a className="inline-flex min-h-11 items-center border-b border-blood" href={wa(r.buyerPhone, r.buyerName, r.ticketToken)} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
                  {r.canReverse && <Reverse r={r} done={load} />}
                  {r.canReverse && <Owe r={r} done={load} />}
                  {r.status !== "paid" && r.buyerPhone && <a className="inline-flex min-h-11 items-center border-b border-blood" href={`tel:${r.buyerPhone}`}>Call</a>}
                  {r.status !== "paid" && r.status !== "needs_refund" && <a className="inline-flex min-h-11 items-center border-b border-blood" href={waConfirm(r.buyerPhone, r.buyerName, r.amountPaise, r.utr)} target="_blank" rel="noreferrer">WhatsApp to confirm</a>}
                  {r.status !== "paid" && <a className="inline-flex min-h-11 items-center border-b border-blood" href={waTo(r.buyerPhone, waText(tpls[kindOf(r)], r, r.reviewNote ?? ""))} target="_blank" rel="noreferrer">Tell them on WhatsApp</a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A rejection where the money had in fact arrived: move it to the refund list. */
function Owe({ r, done }: { r: Row; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    if (!window.confirm(`Add ${r.buyerName} (${paise(r.amountPaise)}) to the refund list? Use this when their money did arrive.`)) return;
    setBusy(true); setMsg("");
    try { await api(`/api/admin/orders/${r.id}/refund-owed`, {}); await done(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }
  return <span className="flex flex-col items-end"><button className="inline-flex min-h-11 items-center border-b border-blood" onClick={go} disabled={busy}>Money received? Refund</button>{msg && <span role="alert" className="text-[13px] text-crimson">{msg}</span>}</span>;
}

/** Change a rejection to approved after the buyer confirmed. Issues and emails the ticket. */
function Reverse({ r, done }: { r: Row; done: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setStep("busy"); setMsg("");
    try {
      const x = await api<{ result: string }>(`/api/admin/orders/${r.id}/approve`, {});
      if (x.result === "needs_refund") throw new Error("Passes sold out in the meantime. Marked as needing a refund.");
      await done();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setStep("idle"); }
  }
  if (step === "idle") return (
    <span className="flex flex-col items-end">
      <button className="inline-flex min-h-11 items-center border-b border-blood font-medium" onClick={() => setStep("confirm")}>Change to approved</button>
      {msg && <span role="alert" className="text-[13px] text-crimson">{msg}</span>}
    </span>
  );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[13px]">Buyer confirmed and bank shows it?</span>
      <button className="btn btn-primary btn-calm min-h-11 px-4" onClick={go} disabled={step === "busy"} aria-busy={step === "busy"}>{step === "busy" ? "Approving…" : "Approve & send ticket"}</button>
      <button className="btn btn-quiet btn-calm min-h-11 px-3" onClick={() => setStep("idle")} disabled={step === "busy"}>Cancel</button>
    </span>
  );
}

function Pending({ r, done, focus, tpls, onSaved }: { r: Row; done: () => void; focus: boolean; tpls: WaTemplates; onSaved: (t: WaTemplates) => void }) {
  const [mode, setMode] = useState<"idle" | "confirm" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<WaKind>("fix");
  const [draft, setDraft] = useState<string | null>(null); // null = the saved preset as is
  const [sendWa, setSendWa] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tpl = draft ?? tpls[kind];
  const dirty = tpl.trim() !== tpls[kind].trim();

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg("");
    try { await fn(); await done(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }
  const approve = () => run(async () => {
    const r2 = await api<{ result: string }>(`/api/admin/orders/${r.id}/approve`, {});
    if (r2.result === "needs_refund") throw new Error("Passes sold out in the meantime. Marked as needing a refund; refund this buyer.");
  });
  const pick = (k: WaKind) => { setKind(k); setDraft(null); setSaved(false); };
  // Open WhatsApp from the tap itself (phones block pop-ups opened after a wait); point it at the message once the rejection succeeds.
  const reject = () => {
    const w = sendWa ? window.open("about:blank", "_blank") : null;
    return run(async () => {
      try {
        await api(`/api/admin/orders/${r.id}/reject`, { reason, resubmit: kind === "fix", refund: kind === "refund" });
      } catch (e) { w?.close(); throw e; }
      if (w) w.location.href = waTo(r.buyerPhone, waText(tpl, r, reason));
    });
  };
  async function savePreset() {
    setSaving(true); setMsg("");
    try { onSaved(await api<WaTemplates>("/api/admin/templates", { ...tpls, [kind]: tpl })); setDraft(null); setSaved(true); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save"); }
    setSaving(false);
  }

  return (
    <article id={`pay-${r.id}`} className={`card p-5 ${focus ? "!border-crimson" : ""}`} aria-label={`Payment from ${r.buyerName}`}>
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
        <div className="mt-5 flex flex-col gap-3">
          <Contact r={r} />
          <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary btn-calm min-h-12 flex-1 sm:flex-none sm:px-8" onClick={() => setMode("confirm")} disabled={busy}>Approve</button>
          <button className="btn btn-quiet btn-calm min-h-12 flex-1 sm:flex-none sm:px-8" onClick={() => setMode("reject")} disabled={busy}>Reject…</button>
          </div>
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
          <p className="text-sm font-medium">Not sure? Check with the buyer first. If they confirm, you can still change a rejection to approved later.</p>
          <Contact r={r} />
          <label htmlFor={`rr-${r.id}`} className="text-sm font-medium">Reason (the buyer sees this, by email and on their order page)</label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick reasons">
            {REASONS.map((x) => (
              <button key={x} type="button" className={`btn btn-quiet btn-calm min-h-11 px-3 text-left text-[13px] ${reason === x ? "!border-crimson" : ""}`} onClick={() => setReason(x)} disabled={busy}>{x}</button>
            ))}
          </div>
          <input id={`rr-${r.id}`} className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type your own reason" disabled={busy} />

          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="text-sm font-medium">What happens</legend>
            {WA_KINDS.map((k) => (
              <label key={k} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm ${kind === k ? "border-crimson" : "border-line"}`}>
                <input type="radio" name={`k-${r.id}`} className="mt-1" checked={kind === k} onChange={() => pick(k)} />
                <span><strong className="text-fg">{WA_LABEL[k]}</strong>
                  <span className="muted block text-[13px]">{k === "fix" ? "Keeps their pass for 2 more hours and emails a link to send the right UTR or screenshot." : k === "reject" ? "Frees the pass and closes the order." : "Frees the pass, closes the order and adds the buyer to the Refunds tab."}</span></span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor={`wm-${r.id}`} className="text-sm font-medium">WhatsApp message (edit it here)</label>
            <textarea id={`wm-${r.id}`} className="field min-h-32 w-full" value={tpl} onChange={(e) => { setDraft(e.target.value); setSaved(false); }} disabled={busy} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Insert a placeholder">
              {WA_PLACEHOLDERS.map((f) => <button key={f} type="button" className="btn btn-quiet btn-calm min-h-11 px-3 text-[13px]" onClick={() => setDraft(`${tpl}${tpl && !/\s$/.test(tpl) ? " " : ""}[${f}]`)} disabled={busy}>[{f}]</button>)}
            </div>
            <p className="label mt-1">What {r.buyerName.split(/\s+/)[0]} will receive</p>
            <p className="card-plain whitespace-pre-wrap p-3 text-sm" aria-live="polite">{waText(tpl, r, reason)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-quiet btn-calm min-h-11 px-4 text-sm" onClick={savePreset} disabled={busy || saving || !dirty} aria-busy={saving}>{saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : saved ? "Saved ✓" : "Save as my default for this option"}</button>
              {draft !== null && dirty && <button type="button" className="muted inline-flex min-h-11 items-center text-sm hover:text-fg" onClick={() => setDraft(null)}>Undo changes</button>}
            </div>
            <p className="muted text-[13px]">Saving updates the preset for every payment, for all admins. Without saving, your edit is used for this buyer only.</p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={sendWa} onChange={(e) => setSendWa(e.target.checked)} disabled={busy} />
            Open WhatsApp with this message after rejecting
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary btn-calm min-h-12 flex-1" disabled={busy || reason.trim().length < 3} onClick={reject} aria-busy={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}{busy ? "Working…" : kind === "fix" ? "Ask to fix & resubmit" : kind === "reject" ? "Reject, no money received" : "Reject & refund"}
            </button>
            <button className="btn btn-quiet btn-calm min-h-12" onClick={() => setMode("idle")} disabled={busy}>Back</button>
          </div>
        </div>
      )}
    </article>
  );
}
