"use client";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { paise } from "@/lib/normalize";
import { formatTimeIST } from "@/lib/time";
import { api } from "./api";
import { Payments } from "./Payments";
import { Activity, Contacts } from "./Contacts";
import { PageText } from "./PageText";
import { Refunds } from "./Refunds";

const TABS = ["Overview", "Payments", "Contacts", "Refunds", "Page text", "Guests", "Passes", "Volunteers", "Check-ins", "Activity", "Tools"] as const;
type Tab = (typeof TABS)[number];

interface Summary {
  counts: { sold: number; capacity: number; held: number; left: number; comps: number; checked_in_tickets: number; checked_in_people: number; people_expected: number };
  money: { gross: number; refunds: number; fees: number; net: number; owed: number };
  needsRefund: { id: string; buyer_name: string; amount_paise: number }[];
  health: { pending_orders: number; awaiting_review: number; failed_emails: number; pending_emails: number; lastWebhook: string | null; fakePayments: boolean };
}
interface Guest { id: string; shortCode: string; name: string; phone: string; email: string | null; instagram: string | null; passName: string; admits: number; status: string; source: string; orderId: string | null; usedAt: string | null; usedBy: string | null }
interface Pass { id: string; name: string; description: string; pricePaise: number; feePaise: number; totalQty: number; admits: number; active: boolean; sort: number; sold: number; held?: number; salesStart: string | null; salesEnd: string | null }

export function AdminApp({ name, initialTab, focusOrder }: { name: string; initialTab?: Tab; focusOrder?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "Overview");
  return (
    <div className="calm min-h-dvh text-[15px]">
      <div className="wrap pb-12">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-2">
          <div className="flex items-center gap-4">
            <Logo size={40} />
            <span className="label">Admin</span>
          </div>
          <div className="muted flex items-center gap-4 text-sm">
            {name}
            <a href="/scan" className="inline-flex min-h-11 items-center border-b border-blood text-fg">Scanner</a>
            <button className="inline-flex min-h-11 items-center hover:text-fg" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Sign out</button>
          </div>
        </header>
        <nav aria-label="Admin sections" className="sticky top-0 z-20 -mx-5 flex gap-x-5 overflow-x-auto border-b border-line bg-bg px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}
              className={`min-h-12 shrink-0 border-b-2 px-1 text-sm transition-colors ${tab === t ? "border-crimson" : "muted border-transparent hover:text-fg"}`}>{t}</button>
          ))}
        </nav>
        <div className="slide-up mt-5" key={tab}>
          {tab === "Overview" && <Overview go={setTab} />}
          {tab === "Payments" && <Payments focusOrder={focusOrder} />}
          {tab === "Contacts" && <Contacts />}
          {tab === "Activity" && <Activity />}
          {tab === "Refunds" && <Refunds />}
          {tab === "Page text" && <PageText />}
          {tab === "Guests" && <Guests />}
          {tab === "Passes" && <Passes />}
          {tab === "Volunteers" && <Volunteers />}
          {tab === "Check-ins" && <Checkins />}
          {tab === "Tools" && <Tools />}
        </div>
      </div>
    </div>
  );
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const reload = useCallback(async (u = url) => {
    try { setData(await api<T>(u)); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload };
}

const Err = ({ m }: { m: string }) => (m ? <p role="alert" className="mt-3 rounded-sm border border-danger p-3 text-sm">{m}</p> : null);
const Stat = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="card-plain min-w-[160px] flex-1 px-5 py-4"><p className="label">{k}</p><p className="tnum mt-1.5 text-[32px] font-semibold">{v}</p></div>
);

function Overview({ go }: { go: (t: Tab) => void }) {
  const { data: s, err, reload } = useLoad<Summary>("/api/admin/summary");
  useEffect(() => { const t = setInterval(() => reload(), 20_000); return () => clearInterval(t); }, [reload]);
  if (err) return <Err m={err} />;
  if (!s) return <div className="skeleton h-64" aria-busy="true" />;
  const attention = s.needsRefund.length + s.health.failed_emails + s.health.awaiting_review;
  return (
    <div className="flex flex-col gap-3">
      {attention > 0 && (
        <section aria-label="Needs attention" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-blood bg-[var(--selected)] px-5 py-4">
          <p><strong className="font-semibold text-crimson">Needs attention:</strong> {s.health.awaiting_review} payments to verify · {s.needsRefund.length} orders need a refund · {s.health.failed_emails} failed emails</p>
          <button className="btn btn-calm min-h-11 text-sm" onClick={() => go(s.health.awaiting_review > 0 ? "Payments" : "Tools")}>Review</button>
        </section>
      )}
      <section aria-label="Counts" className="flex flex-wrap gap-3">
        <Stat k="Tickets sold" v={s.counts.sold} />
        <Stat k="Still available" v={s.counts.left} />
        <Stat k="Checked in (people)" v={`${s.counts.checked_in_people}/${s.counts.people_expected}`} />
        <Stat k="Pending orders" v={s.health.pending_orders} />
      </section>
      <section aria-label="Collections" className="card-plain p-5">
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          {([["Collected (tickets)", s.money.gross], ["Refunded", s.money.refunds], ["Still to refund", s.money.owed]] as const).map(([k, v]) => (
            <div key={k}><p className="label">{k}</p><p className="tnum mt-1 text-2xl font-semibold">{paise(v)}</p></div>
          ))}
        </div>
        <p className="muted mt-4 text-[13px]">Collected = approved UPI payments (tickets issued). Money you should be holding for this event ≈ collected + still to refund. Comp tickets ({s.counts.comps}) carry no money. Refunds are sent from your UPI app, then marked here.</p>
      </section>
      {s.needsRefund.length > 0 && (
        <section className="card-plain p-5">
          <h2 className="text-lg">Refunds to send ({s.needsRefund.length})</h2>
          <p className="muted mt-2 text-sm">{paise(s.money.owed)} is owed back to buyers who paid but won&apos;t get a ticket.</p>
          <button className="btn btn-primary btn-calm mt-3 min-h-12 px-6" onClick={() => go("Refunds")}>Open refunds</button>
        </section>
      )}
      <p className="muted text-[13px]">Emails waiting to send: {s.health.pending_emails} · Failed: {s.health.failed_emails}</p>
    </div>
  );
}

function Guests() {
  const [q, setQ] = useState("");
  const { data, err, reload } = useLoad<Guest[]>("/api/admin/guests");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { const t = setTimeout(() => reload(`/api/admin/guests?q=${encodeURIComponent(q)}`), 250); return () => clearTimeout(t); }, [q, reload]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg("");
    try { await fn(); setMsg(ok); setConfirm(""); reload(`/api/admin/guests?q=${encodeURIComponent(q)}`); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  const actions = (g: Guest) => (
    <>
      {g.status === "valid" && (confirm === g.id
        ? <button className="btn btn-primary btn-calm min-h-11 px-3 text-sm" onClick={() => act(() => api(`/api/admin/tickets/${g.id}/revoke`, {}), "Ticket revoked")}>Confirm revoke</button>
        : <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setConfirm(g.id)}>Revoke</button>)}
      {g.orderId && <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => act(() => api(`/api/admin/orders/${g.orderId}/resend`, {}), "Email queued and sent")}>Resend email</button>}
    </>
  );
  const status = (g: Guest) => g.status === "used" ? `Used ${g.usedAt ? formatTimeIST(g.usedAt) : ""}` : g.status === "revoked" ? "Revoked" : "Valid";
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg">Guests</h2>
        <div className="flex max-w-[520px] flex-[1_1_320px] flex-col gap-1.5">
          <label htmlFor="a-q" className="muted text-[13px]">Search name, phone, ticket ID, short code or Instagram</label>
          <input id="a-q" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </div>
      </div>
      <Err m={err} />
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      {/* Phones: one card per guest. */}
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {data?.map((g) => (
          <li key={g.id} className="card-plain p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold">{g.name}{g.source === "comp" && <span className="muted font-normal"> · comp</span>}</p>
              <span className={`shrink-0 text-sm ${g.status === "revoked" ? "text-crimson" : "muted"}`}>{status(g)}</span>
            </div>
            <p className="muted tnum mt-1 text-[13px]">{g.shortCode} · {g.passName} ×{g.admits}</p>
            <p className="tnum mt-1 text-sm">{g.phone}{g.instagram ? <span className="muted"> · @{g.instagram}</span> : null}</p>
            <div className="mt-3 flex flex-wrap gap-2">{actions(g)}</div>
          </li>
        ))}
        {data?.length === 0 && <li className="muted py-4 text-sm">No guests match.</li>}
      </ul>
      {/* Desktop: table. */}
      <div className="mt-4 hidden overflow-x-auto rounded-sm border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-card text-left text-muted">{["Name", "Code", "Pass", "Phone", "Instagram", "Status", "Actions"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {data?.map((g) => (
              <tr key={g.id} className="border-t border-line align-top">
                <td className="px-4 py-3">{g.name}{g.source === "comp" && <span className="muted"> · comp</span>}</td>
                <td className="px-4 py-3 tnum">{g.shortCode}</td>
                <td className="px-4 py-3">{g.passName} <span className="muted">×{g.admits}</span></td>
                <td className="px-4 py-3 tnum">{g.phone}</td>
                <td className="px-4 py-3">{g.instagram ? `@${g.instagram}` : "—"}</td>
                <td className={`px-4 py-3 ${g.status === "revoked" ? "text-crimson" : ""}`}>{status(g)}</td>
                <td className="flex flex-wrap gap-2 px-4 py-2">{actions(g)}</td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={7} className="muted px-4 py-6">No guests match.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const rupees = (p: number) => String(p / 100);
const toPaise = (s: string) => Math.round(parseFloat(s || "0") * 100);

function Passes() {
  const { data, err, reload } = useLoad<Pass[]>("/api/admin/passes");
  const [msg, setMsg] = useState("");
  return (
    <section>
      <h2 className="text-lg">Passes</h2>
      <p className="muted mt-1 text-sm">Pick one admission (admits 1) or a couple pass (admits 2: one QR, one scan). Prices in rupees.</p>
      <Err m={err} />{msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      <div className="mt-4 flex flex-col gap-3">
        {data?.map((p) => <PassRow key={p.id} p={p} onSaved={(m) => { setMsg(m); reload(); }} />)}
        <PassRow p={{ id: "", name: "", description: "", pricePaise: 0, feePaise: 0, totalQty: 0, admits: 1, active: false, sort: (data?.length ?? 0), sold: 0, salesStart: null, salesEnd: null }} fresh onSaved={(m) => { setMsg(m); reload(); }} />
      </div>
    </section>
  );
}

function PassRow({ p, fresh, onSaved }: { p: Pass; fresh?: boolean; onSaved: (m: string) => void }) {
  const [f, setF] = useState({ name: p.name, description: p.description, price: rupees(p.pricePaise), fee: rupees(p.feePaise), total: String(p.totalQty), admits: String(p.admits), active: p.active });
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [m, setM] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function save() {
    setState("loading"); setM("");
    try {
      await api("/api/admin/passes", {
        id: p.id || undefined, name: f.name, description: f.description, pricePaise: toPaise(f.price), feePaise: toPaise(f.fee),
        totalQty: parseInt(f.total || "0", 10), admits: parseInt(f.admits || "1", 10), active: f.active, sort: p.sort, salesStart: p.salesStart, salesEnd: p.salesEnd,
      });
      setState("ok"); onSaved(fresh ? "Pass added" : "Pass saved");
      if (fresh) setF({ name: "", description: "", price: "0", fee: "0", total: "0", admits: "1", active: false });
      setTimeout(() => setState("idle"), 1500);
    } catch (e) { setState("error"); setM(e instanceof Error ? e.message : "Failed"); }
  }
  const cell = "flex flex-col gap-1";
  return (
    <div className={`card-plain flex flex-wrap items-end gap-3 p-4 ${fresh ? "border-dashed" : ""}`}>
      <div className={`${cell} min-w-[180px] flex-[2]`}><label className="label">{fresh ? "New pass name" : "Name"}</label><input className="field" value={f.name} onChange={set("name")} /></div>
      <div className={`${cell} min-w-[120px] flex-1`}><label className="label">Price ₹</label><input className="field" inputMode="decimal" value={f.price} onChange={set("price")} /></div>
      <div className={`${cell} min-w-[100px] flex-1`}><label className="label">Fee ₹</label><input className="field" inputMode="decimal" value={f.fee} onChange={set("fee")} /></div>
      <div className={`${cell} min-w-[100px] flex-1`}><label className="label">Total qty</label><input className="field" inputMode="numeric" value={f.total} onChange={set("total")} /></div>
      <div className="flex basis-full flex-wrap items-center gap-2" role="group" aria-label="Change total quantity">
        {[-10, -1, 1, 10].map((d) => (
          <button key={d} type="button" className="btn btn-quiet btn-calm min-h-11 px-4 text-sm tnum" onClick={() => setF({ ...f, total: String(Math.max(0, (parseInt(f.total || "0", 10) || 0) + d)) })}>{d > 0 ? `+${d}` : d}</button>
        ))}
        {!fresh && <span className="muted text-sm tnum">{p.sold} sold · {p.held ?? 0} held · {Math.max(0, (parseInt(f.total || "0", 10) || 0) - p.sold - (p.held ?? 0))} left. Save to apply.</span>}
      </div>
      <div className={`${cell} min-w-[90px] flex-1`}><label className="label">Admits</label><input className="field" inputMode="numeric" value={f.admits} onChange={set("admits")} /></div>
      <div className={`${cell} basis-full`}><label className="label">Description</label><input className="field" value={f.description} onChange={set("description")} /></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.active} onChange={set("active")} /> On sale</label>
            <button className="btn btn-primary btn-calm ml-auto min-h-11 px-5 text-sm" onClick={save} disabled={state === "loading" || !f.name}>
        {state === "loading" && <span className="spinner" aria-hidden="true" />}{state === "ok" ? "Saved" : fresh ? "Add pass" : "Save"}
      </button>
      {m && <p role="alert" className="basis-full text-sm text-danger">{m}</p>}
    </div>
  );
}

const ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Readable random password: no look-alike characters (0/O, 1/l/I). */
function genPassword() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
}

function Volunteers() {
  const { data, err, reload } = useLoad<{ id: string; email: string; name: string; role: string; active: boolean }[]>("/api/admin/volunteers");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "volunteer" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ email: string; password: string } | null>(null);
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(""); setMade(null);
    try { await api("/api/admin/volunteers", f); setMade({ email: f.email.trim().toLowerCase(), password: f.password }); setF({ name: "", email: "", password: "", role: "volunteer" }); reload(); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
    setBusy(false);
  }
  async function toggle(id: string, active: boolean) {
    setMsg("");
    try { await api(`/api/admin/volunteers/${id}`, { active }); reload(); } catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
  }
  async function doReset() {
    if (!reset) return; setMsg("");
    try { await api(`/api/admin/volunteers/${reset.id}/password`, { password: reset.password }); const u = data?.find((x) => x.id === reset.id); setMade({ email: u?.email ?? "", password: reset.password }); setReset(null); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ } }
  return (
    <section className="flex flex-wrap gap-6">
      <div className="min-w-0 flex-[2_1_320px]">
        <h2 className="text-lg">Staff accounts</h2><Err m={err} />{msg && <p role="alert" className="mt-3 rounded-sm border border-danger p-3 text-sm">{msg}</p>}
        {made && (
          <div role="status" className="mt-3 rounded-sm border border-line-strong p-4 text-sm">
            <p className="font-semibold">Share these privately. The password is shown only now.</p>
            <p className="tnum mt-2 break-all">{made.email}<br />{made.password}</p>
            <button className="btn btn-quiet btn-calm mt-3 min-h-11 px-4 text-sm" onClick={() => copy(`Email: ${made.email}\nPassword: ${made.password}\nScanner: ${location.origin}/scan`)}>{copied ? "Copied" : "Copy login details"}</button>
          </div>
        )}
        <ul className="card-plain mt-3 divide-y divide-line">
          {data?.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0"><span className={`font-medium ${u.active ? "" : "muted line-through"}`}>{u.name}</span> <span className="muted">· {u.role}{u.active ? "" : " · no access"}</span><span className="muted block break-all">{u.email}</span></span>
                <span className="flex flex-wrap gap-2">
                  <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setReset(reset?.id === u.id ? null : { id: u.id, password: genPassword() })}>New password</button>
                  <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => toggle(u.id, !u.active)}>{u.active ? "Revoke access" : "Restore"}</button>
                </span>
              </div>
              {reset?.id === u.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <input className="field tnum min-w-[200px] flex-1" value={reset.password} onChange={(e) => setReset({ id: u.id, password: e.target.value })} aria-label={`New password for ${u.name}`} autoComplete="off" />
                  <button className="btn btn-primary btn-calm min-h-11 px-4 text-sm" onClick={doReset} disabled={reset.password.length < 10}>Set password</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="muted mt-3 text-[13px]">Setting a new password signs that person out everywhere. Revoking access does the same, instantly.</p>
      </div>
      <form onSubmit={create} className="card-plain flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-4">
        <h2 className="text-lg">Add volunteer</h2>
        {(["name", "email"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1"><label className="label" htmlFor={`v-${k}`}>{k}</label>
            <input id={`v-${k}`} className="field" type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete="off" /></div>
        ))}
        <div className="flex flex-col gap-1"><label className="label" htmlFor="v-password">password</label>
          <div className="flex gap-2">
            <input id="v-password" className="field tnum min-w-0 flex-1" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
            <button type="button" className="btn btn-quiet btn-calm min-h-11 shrink-0 px-3 text-sm" onClick={() => setF({ ...f, password: genPassword() })}>Generate</button>
          </div></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.role === "admin"} onChange={(e) => setF({ ...f, role: e.target.checked ? "admin" : "volunteer" })} /> Make admin (full access)</label>
        <button className="btn btn-primary btn-calm min-h-12" disabled={busy || !f.name || !f.email || f.password.length < 10}>{busy && <span className="spinner" aria-hidden="true" />}Create account</button>
        <p className="muted text-[13px]">Volunteers can only scan and look guests up. Password: at least 10 characters.</p>
      </form>
    </section>
  );
}

function Checkins() {
  const { data, err } = useLoad<{ at: string; outcome: string; method: string; mode: string; shortCode: string | null; name: string | null; staff: string }[]>("/api/admin/checkins");
  return (
    <section>
      <h2 className="text-lg">Recent check-ins</h2><Err m={err} />
      <ul className="card-plain mt-3 divide-y divide-line">
        {data?.map((c, i) => (
          <li key={i} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
            <span className={c.outcome === "admitted" ? "" : "text-crimson"}>
              {c.outcome === "admitted" ? "" : `${c.outcome.replace("_", " ")} · `}{c.name ?? "Unknown code"} · {c.staff} · {c.method}
            </span>
            <span className="muted tnum">{formatTimeIST(c.at)}</span>
          </li>
        ))}
        {data?.length === 0 && <li className="muted px-4 py-6 text-sm">No scans yet.</li>}
      </ul>
    </section>
  );
}

function Tools() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const passes = useLoad<Pass[]>("/api/admin/passes");
  const [c, setC] = useState({ passTypeId: "", name: "", phone: "", email: "", instagram: "", reason: "" });
  const [comp, setComp] = useState<{ shortCode: string; token: string } | null>(null);

  async function issue(e: React.FormEvent) {
    e.preventDefault(); setBusy("comp"); setMsg(""); setComp(null);
    try { setComp(await api("/api/admin/tickets/comp", { ...c, email: c.email || null, instagram: c.instagram || undefined, passTypeId: c.passTypeId || passes.data?.[0]?.id })); setMsg("Comp ticket issued and written to the audit log."); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
    setBusy("");
  }
  const dl = "btn btn-quiet btn-calm min-h-12 px-4 text-sm";
  return (
    <section className="flex flex-wrap gap-6">
      <div className="card-plain min-w-[320px] flex-1 p-5">
        <h2 className="text-lg">Export &amp; print</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className={dl} href="/api/admin/export?kind=attendees&format=xlsx">Attendees .xlsx</a>
          <a className={dl} href="/api/admin/export?kind=attendees&format=csv">Attendees .csv</a>
          <a className={dl} href="/api/admin/export?kind=checkins&format=xlsx">Check-ins .xlsx</a>
          <a className={dl} href="/api/admin/export?kind=checkins&format=csv">Check-ins .csv</a>
          <a className={dl} href="/admin/print" target="_blank">Print guest list</a>
        </div>
        <p className="muted mt-4 text-[13px]">Exports contain full phone numbers and emails and are logged. Keep a copy on two admin phones before the event.</p>
      </div>
      <form onSubmit={issue} className="card-plain flex min-w-[320px] flex-1 flex-col gap-3 p-5">
        <h2 className="text-lg">Issue comp ticket</h2>
        <p className="muted text-sm">For guests who paid by other means. A reason is required and written to the audit log.</p>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="c-pass">Pass</label>
          <select id="c-pass" className="field" value={c.passTypeId} onChange={(e) => setC({ ...c, passTypeId: e.target.value })}>
            {passes.data?.map((p) => <option key={p.id} value={p.id}>{p.name} (admits {p.admits})</option>)}
          </select></div>
        {([["name", "Full name"], ["phone", "Mobile number"], ["email", "Email (optional)"], ["instagram", "Instagram (optional)"], ["reason", "Reason"]] as const).map(([k, l]) => (
          <div key={k} className="flex flex-col gap-1"><label className="label" htmlFor={`c-${k}`}>{l}</label>
            <input id={`c-${k}`} className="field" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>
        ))}
        <button className="btn btn-primary btn-calm min-h-12" disabled={busy === "comp" || !c.name || !c.phone || c.reason.length < 3}>{busy === "comp" && <span className="spinner" aria-hidden="true" />}Issue ticket</button>
        {comp && <p className="rounded-sm border border-line-strong p-3 text-sm break-all">Code <strong className="tnum">{comp.shortCode}</strong><br /><a className="border-b border-blood" href={`/t/${comp.token}`} target="_blank">Open ticket link</a></p>}
      </form>
      {msg && <p role="status" className="basis-full text-sm">{msg}</p>}
    </section>
  );
}
