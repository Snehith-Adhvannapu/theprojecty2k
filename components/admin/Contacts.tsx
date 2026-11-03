"use client";
// Everyone who entered their details: search, filter, one-click WhatsApp with a custom message, export.
import { useCallback, useEffect, useMemo, useState } from "react";
import { paise } from "@/lib/normalize";
import { formatFullIST } from "@/lib/time";
import { api } from "./api";
import { Tip } from "@/components/Tip";

interface Contact {
  orderId: string; name: string; phone: string; email: string; instagram: string | null;
  status: string; statusLabel: string; pass: string; qty: number; amountPaise: number; at: string;
}

const FILTERS: [string, string][] = [["all", "Everyone"], ["paid", "Paid"], ["review", "In review"], ["unpaid", "Not paid yet"], ["problem", "Rejected / refund"]];
const FIELDS = ["name", "first name", "pass", "tickets", "amount", "email", "order"] as const;
const DEFAULT_MSG = "Hi [name], this is Project Y2K. ";
const KEY = "y2k_wa_template";

/** Replaces [name], [first name], [pass], [tickets], [amount], [email], [order] (any case) with the person's details. */
export function fillTemplate(t: string, c: Contact) {
  const vals: Record<string, string> = {
    name: c.name, "first name": c.name.trim().split(/\s+/)[0], pass: c.pass, tickets: String(c.qty),
    amount: paise(c.amountPaise), email: c.email, order: c.orderId.slice(0, 8).toUpperCase(),
  };
  return t.replace(/\[\s*([a-z ]+?)\s*\]/gi, (m, k: string) => vals[k.toLowerCase().replace(/\s+/g, " ")] ?? m);
}
const waLink = (c: Contact, t: string) => `https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(fillTemplate(t, c))}`;

export function Contacts() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [unique, setUnique] = useState(true);
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [err, setErr] = useState("");
  const [tpl, setTpl] = useState(DEFAULT_MSG);
  const [copied, setCopied] = useState("");

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setTpl(s); } catch { /* private mode */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY, tpl); } catch { /* private mode */ } }, [tpl]);

  const load = useCallback(async () => {
    try { setRows(await api<Contact[]>(`/api/admin/contacts?status=${status}&unique=${unique ? 1 : 0}&q=${encodeURIComponent(q)}`)); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }, [status, unique, q]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const exp = (fmt: string) => `/api/admin/export?kind=contacts&format=${fmt}&status=${status}&unique=${unique ? 1 : 0}`;
  const sample = rows?.[0];
  const preview = useMemo(() => (sample ? fillTemplate(tpl, sample) : tpl), [tpl, sample]);
  async function copy(id: string, text: string) { try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ } }
  const dl = "btn btn-quiet btn-calm min-h-11 px-4 text-sm";

  return (
    <section className="flex flex-col gap-5">
      <div data-tour="ct-template" className="card-plain p-5">
        <h2 className="flex items-center gap-1.5 text-lg">Message template<Tip text="Your default WhatsApp message. Words in [square brackets] are replaced with each person's own details when you tap their WhatsApp button." /></h2>
        <p className="muted mt-1 text-sm">Write once. Every WhatsApp button below fills in the person&apos;s details. Saved on this device.</p>
        <label htmlFor="tpl" className="sr-only">WhatsApp message</label>
        <textarea id="tpl" className="field mt-3 min-h-28 w-full" value={tpl} onChange={(e) => setTpl(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Insert a placeholder">
          {FIELDS.map((f) => <button key={f} type="button" className="btn btn-quiet btn-calm min-h-11 px-3 text-[13px]" onClick={() => setTpl((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}[${f}]`)}>[{f}]</button>)}
        </div>
        {sample && <p className="muted mt-3 text-[13px]"><strong className="text-fg">Preview for {sample.name}:</strong> {preview}</p>}
      </div>

      <div data-tour="ct-filters" className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map(([k, l]) => <button key={k} className={`btn btn-quiet btn-calm min-h-11 px-4 text-sm ${status === k ? "!border-crimson" : ""}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cq" className="sr-only">Search</label>
        <input id="cq" className="field min-w-[220px] flex-1" placeholder="Search name, phone, email or Instagram" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--crimson)]" checked={unique} onChange={(e) => setUnique(e.target.checked)} />One row per phone number <Tip text="Someone who tried more than once appears once, showing their most complete order. Untick to see every order." /></label>
      </div>
      <div data-tour="ct-export" className="flex flex-wrap items-center gap-3">
        <a className={dl} href={exp("xlsx")}>Export Excel (.xlsx)</a>
        <a className={dl} href={exp("csv")}>Export CSV</a>
        <span className="muted text-[13px]">{rows ? `${rows.length} ${rows.length === 1 ? "person" : "people"}` : ""} · exports use the filter above and are logged.</span>
      </div>

      {err && <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>}
      {!rows && !err && <div className="skeleton h-48" aria-busy="true" />}
      {rows && rows.length === 0 && <p className="card-plain muted p-5 text-sm">Nobody here yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="card-plain divide-y divide-line">
          {rows.map((c) => (
            <li key={c.orderId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="text-base font-semibold">{c.name} <span className={`ml-1 text-[13px] font-normal ${c.status === "paid" ? "" : "text-crimson"}`}>{c.statusLabel}</span></p>
                <p className="muted tnum">{c.phone} · <span className="break-all">{c.email}</span></p>
                <p className="muted text-[13px]">{c.instagram ? `@${c.instagram} · ` : ""}{c.pass} × {c.qty} · {paise(c.amountPaise)} · {formatFullIST(c.at)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <a className="btn btn-primary btn-calm min-h-11 basis-full px-5 text-sm sm:basis-auto" href={waLink(c, tpl)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.name}`}>WhatsApp</a>
                <a className="btn btn-quiet btn-calm min-h-11 flex-1 px-4 text-sm sm:flex-none" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}>Call</a>
                <button className="btn btn-quiet btn-calm min-h-11 flex-1 px-4 text-sm sm:flex-none" onClick={() => copy(c.orderId, fillTemplate(tpl, c))}>{copied === c.orderId ? "Copied" : "Copy"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Act { at: string; action: string; who: string; target: string; detail: string }

/** Every staff action: who, what, when. */
export function Activity() {
  const [rows, setRows] = useState<Act[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setRows(await api<Act[]>("/api/admin/activity")); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3"><h2 className="flex items-center gap-1.5 text-lg">Activity<Tip text="A permanent record of staff actions. Use it to check who approved a payment or changed a pass." /></h2><button className="muted inline-flex min-h-11 items-center text-sm hover:text-fg" onClick={load}>Refresh</button></div>
      <p className="muted text-sm">Every approval, rejection, export, pass change and account change, newest first.</p>
      {err && <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>}
      {!rows && !err && <div className="skeleton h-48" aria-busy="true" />}
      {rows && (
        <ul data-tour="ac-list" className="card-plain divide-y divide-line">
          {rows.length === 0 && <li className="muted p-5 text-sm">No activity yet.</li>}
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span><span className="font-medium">{r.action.replace(/_/g, " ")}</span> <span className="muted">by {r.who}{r.target ? ` · ${r.target}` : ""}{r.detail ? ` · ${r.detail}` : ""}</span></span>
              <span className="muted tnum text-[13px]">{formatFullIST(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
