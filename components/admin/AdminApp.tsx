"use client";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { paise } from "@/lib/normalize";
import { formatFullIST, formatTimeIST } from "@/lib/time";
import { api } from "./api";
import { Payments } from "./Payments";

const TABS = ["Overview", "Payments", "Guests", "Passes", "Volunteers", "Check-ins", "Tools"] as const;
type Tab = (typeof TABS)[number];

interface Summary {
  counts: { sold: number; capacity: number; held: number; left: number; comps: number; checked_in_tickets: number; checked_in_people: number; people_expected: number };
  money: { gross: number; refunds: number; fees: number; net: number };
  needsRefund: { id: string; buyer_name: string; amount_paise: number }[];
  health: { pending_orders: number; awaiting_review: number; failed_emails: number; pending_emails: number; lastWebhook: string | null; fakePayments: boolean };
}
interface Guest { id: string; shortCode: string; name: string; phone: string; email: string | null; instagram: string | null; passName: string; admits: number; status: string; source: string; orderId: string | null; usedAt: string | null; usedBy: string | null }
interface Pass { id: string; name: string; description: string; pricePaise: number; feePaise: number; totalQty: number; admits: number; active: boolean; sort: number; sold: number; salesStart: string | null; salesEnd: string | null }

export function AdminApp({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="calm min-h-dvh text-[15px]">
      <div className="wrap pb-12">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-2">
          <div className="flex items-center gap-4">
            <Logo plain className="!text-[28px]" />
            <span className="label">Admin</span>
          </div>
          <div className="muted flex items-center gap-4 text-sm">
            {name}
            <a href="/scan" className="inline-flex min-h-11 items-center border-b border-blood text-fg">Scanner</a>
            <button className="inline-flex min-h-11 items-center hover:text-fg" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Sign out</button>
          </div>
        </header>
        <nav aria-label="Admin sections" className="-mx-1 flex flex-wrap gap-x-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}
              className={`min-h-11 border-b-2 px-1 text-sm transition-colors ${tab === t ? "border-crimson" : "muted border-transparent hover:text-fg"}`}>{t}</button>
          ))}
        </nav>
        <div className="slide-up mt-6" key={tab}>
          {tab === "Overview" && <Overview go={setTab} />}
          {tab === "Payments" && <Payments />}
          {tab === "Guests" && <Guests />}
          {tab === "Passes" && <Passes />}
          {tab === "Volunteers" && <Volunteers />}
          {tab === "Check-ins" && <Checkins />}
          {tab === "Tools" && <Tools />}
        </div>
        <p className="muted mt-10 text-xs">Ticketing powered by Khelo</p>
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
          {([["Gross collected", s.money.gross], ["Refunded", s.money.refunds], ["Gateway fees", s.money.fees], ["Net", s.money.net]] as const).map(([k, v]) => (
            <div key={k}><p className="label">{k}</p><p className="tnum mt-1 text-2xl font-semibold">{paise(v)}</p></div>
          ))}
        </div>
        <p className="muted mt-4 text-[13px]">Gross = captured + refunded payments. Net = gross − refunds − gateway fees. Fees show only once the gateway reports them, so net can be slightly high until then. Comp tickets ({s.counts.comps}) carry no money.</p>
      </section>
      {s.needsRefund.length > 0 && (
        <section className="card-plain p-5">
          <h2 className="text-lg">Paid but no ticket (refund these)</h2>
          <ul className="mt-3 divide-y divide-line">
            {s.needsRefund.map((o) => <li key={o.id} className="flex justify-between gap-3 py-2.5 text-sm"><span>{o.buyer_name} · <span className="muted">{o.id.slice(0, 8)}</span></span><span className="tnum">{paise(o.amount_paise)}</span></li>)}
          </ul>
          <p className="muted mt-3 text-[13px]">Refund these buyers from your UPI app, then tell them on WhatsApp.</p>
        </section>
      )}
      <p className="muted text-[13px]">Last webhook: {s.health.lastWebhook ? formatFullIST(s.health.lastWebhook) : "none yet"} · Pending emails: {s.health.pending_emails}</p>
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
      <div className="mt-4 overflow-x-auto rounded-sm border border-line">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead><tr className="bg-card text-left text-muted">{["Name", "Code", "Pass", "Phone", "Instagram", "Status", "Actions"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {data?.map((g) => (
              <tr key={g.id} className="border-t border-line align-top">
                <td className="px-4 py-3">{g.name}{g.source === "comp" && <span className="muted"> · comp</span>}</td>
                <td className="px-4 py-3 tnum">{g.shortCode}</td>
                <td className="px-4 py-3">{g.passName} <span className="muted">×{g.admits}</span></td>
                <td className="px-4 py-3 tnum">{g.phone}</td>
                <td className="px-4 py-3">{g.instagram ? `@${g.instagram}` : "—"}</td>
                <td className={`px-4 py-3 ${g.status === "revoked" ? "text-crimson" : ""}`}>{g.status === "used" ? `Used ${g.usedAt ? formatTimeIST(g.usedAt) : ""}` : g.status === "revoked" ? "Revoked" : "Valid"}</td>
                <td className="flex flex-wrap gap-2 px-4 py-2">
                  {g.status === "valid" && (confirm === g.id
                    ? <button className="btn btn-primary btn-calm min-h-11 px-3 text-sm" onClick={() => act(() => api(`/api/admin/tickets/${g.id}/revoke`, {}), "Ticket revoked")}>Confirm revoke</button>
                    : <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setConfirm(g.id)}>Revoke</button>)}
                  {g.orderId && <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => act(() => api(`/api/admin/orders/${g.orderId}/resend`, {}), "Email queued and sent")}>Resend email</button>}
                </td>
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
      <div className={`${cell} min-w-[90px] flex-1`}><label className="label">Admits</label><input className="field" inputMode="numeric" value={f.admits} onChange={set("admits")} /></div>
      <div className={`${cell} basis-full`}><label className="label">Description</label><input className="field" value={f.description} onChange={set("description")} /></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.active} onChange={set("active")} /> On sale</label>
      {!fresh && <span className="muted text-sm tnum">{p.sold} sold</span>}
      <button className="btn btn-primary btn-calm ml-auto min-h-11 px-5 text-sm" onClick={save} disabled={state === "loading" || !f.name}>
        {state === "loading" && <span className="spinner" aria-hidden="true" />}{state === "ok" ? "Saved" : fresh ? "Add pass" : "Save"}
      </button>
      {m && <p role="alert" className="basis-full text-sm text-danger">{m}</p>}
    </div>
  );
}

function Volunteers() {
  const { data, err, reload } = useLoad<{ id: string; email: string; name: string; role: string; active: boolean }[]>("/api/admin/volunteers");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "volunteer" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try { await api("/api/admin/volunteers", f); setF({ name: "", email: "", password: "", role: "volunteer" }); setMsg("Account created"); reload(); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
    setBusy(false);
  }
  async function toggle(id: string, active: boolean) {
    try { await api(`/api/admin/volunteers/${id}`, { active }); reload(); } catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
  }
  return (
    <section className="flex flex-wrap gap-6">
      <div className="min-w-[320px] flex-[2]">
        <h2 className="text-lg">Staff accounts</h2><Err m={err} />
        <ul className="mt-3 divide-y divide-line card-plain">
          {data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span><span className={u.active ? "" : "muted line-through"}>{u.name}</span> <span className="muted">· {u.email} · {u.role}</span></span>
              <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => toggle(u.id, !u.active)}>{u.active ? "Revoke access" : "Restore"}</button>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={create} className="card-plain flex min-w-[300px] flex-1 flex-col gap-3 p-4">
        <h2 className="text-lg">Add volunteer</h2>
        {(["name", "email", "password"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1"><label className="label" htmlFor={`v-${k}`}>{k}</label>
            <input id={`v-${k}`} className="field" type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete="off" /></div>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.role === "admin"} onChange={(e) => setF({ ...f, role: e.target.checked ? "admin" : "volunteer" })} /> Make admin</label>
        <button className="btn btn-primary btn-calm min-h-12" disabled={busy || !f.name || !f.email || f.password.length < 10}>{busy && <span className="spinner" aria-hidden="true" />}Create account</button>
        <p className="muted text-[13px]">Password: at least 10 characters. Share it privately; they can be revoked instantly.</p>
        {msg && <p role="status" className="text-sm">{msg}</p>}
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
