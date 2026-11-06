"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Tip } from "@/components/Tip";
import { paise } from "@/lib/normalize";
import { formatTimeIST } from "@/lib/time";
import { api } from "./api";
import { Payments } from "./Payments";
import { Activity, Contacts } from "./Contacts";
import { PageText } from "./PageText";
import { Refunds } from "./Refunds";
import { Analytics } from "./Analytics";
import { Guide } from "./Guide";
import { EmailUpdate } from "./EmailUpdate";
import { Money } from "./Money";
import { ShareLinks } from "./ShareLinks";
import { AdminNav, Icon } from "./AdminNav";
import { Tour } from "./Tour";
import { tourSteps } from "./tour-steps";

const TABS = ["Overview", "Guide", "Payments", "Contacts", "Refunds", "Page text", "Guests", "Passes", "Volunteers", "Check-ins", "Email update", "Activity", "Tools", "Analytics"] as const;
type Tab = (typeof TABS)[number];

const TAB_HELP: Record<Tab, string> = {
  Overview: "A quick look at sales, check-ins, money and anything that needs you.",
  Guide: "Your event-day plan, what every tab does, and fixes for common problems. Start the guided tour from here.",
  Payments: "Buyers who paid and sent proof. Check your bank statement, then approve or reject.",
  Contacts: "Everyone who started an order, paid or not. Message them on WhatsApp, call them, or export the list.",
  Refunds: "Who should get money back, who already has, and how it was sent.",
  "Page text": "Change any wording on the public landing page.",
  Guests: "Everyone holding a ticket. Search a guest or resend their ticket email.",
  "Email update": "Send a stylish Project Y2K email to ticket holders or to people who have not bought yet.",
  Passes: "The kinds of ticket you sell: price, how many exist, and whether they are on sale.",
  Volunteers: "Staff logins. Volunteers can only scan tickets; admins can do everything.",
  "Check-ins": "The latest scans at the door, including refused ones.",
  Activity: "A log of every staff action, so you can see who did what.",
  Tools: "Exports, a printable guest list, and free (comp) tickets.",
  Analytics: "Who is visiting the site, where they come from, and how many go on to buy. Only you can see this.",
};

interface Summary {
  counts: { sold: number; capacity: number; held: number; left: number; comps: number; checked_in_tickets: number; checked_in_people: number; people_expected: number };
  money: { gross: number; refunds: number; fees: number; net: number; owed: number; inBank: number; bookingFees: number; todayPaise: number; todayPasses: number };
  needsRefund: { id: string; buyer_name: string; amount_paise: number }[];
  health: { pending_orders: number; awaiting_review: number; failed_emails: number; pending_emails: number; lastWebhook: string | null; fakePayments: boolean };
}
interface Guest { id: string; shortCode: string; name: string; phone: string; email: string | null; instagram: string | null; passName: string; admits: number; status: string; source: string; orderId: string | null; usedAt: string | null; usedBy: string | null }
interface Pass { id: string; name: string; description: string; pricePaise: number; feePaise: number; totalQty: number; admits: number; active: boolean; sort: number; sold: number; held?: number; salesStart: string | null; salesEnd: string | null }

const GROUPS: { title: string; items: { id: Tab; icon: string }[] }[] = [
  { title: "Daily work", items: [{ id: "Overview", icon: "grid" }, { id: "Payments", icon: "card" }, { id: "Refunds", icon: "undo" }, { id: "Guests", icon: "ticket" }, { id: "Check-ins", icon: "scan" }] },
  { title: "Manage", items: [{ id: "Contacts", icon: "chat" }, { id: "Email update", icon: "mail" }, { id: "Passes", icon: "tag" }, { id: "Volunteers", icon: "users" }, { id: "Page text", icon: "text" }, { id: "Tools", icon: "tool" }] },
  { title: "More", items: [{ id: "Activity", icon: "list" }, { id: "Analytics", icon: "chart" }, { id: "Guide", icon: "book" }] },
];

export function AdminApp({ name, isSuper, initialTab, focusOrder }: { name: string; isSuper?: boolean; initialTab?: Tab; focusOrder?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "Overview");
  const [tour, setTour] = useState<number | null>(null);
  const [collapsed, setCollapsedState] = useState(false);
  const [menu, setMenu] = useState(false); // the phone drawer
  const steps = tourSteps(!!isSuper);
  useEffect(() => { try { setCollapsedState(localStorage.getItem("y2k_nav_collapsed") === "1"); } catch { /* private mode */ } }, []);
  const setCollapsed = (v: boolean) => { setCollapsedState(v); try { localStorage.setItem("y2k_nav_collapsed", v ? "1" : "0"); } catch { /* private mode */ } };
  // Red numbers on the items that are waiting for a person: payments to verify, refunds to send. Refreshed every 20s and on each tab change.
  const [badge, setBadge] = useState<Partial<Record<Tab, number>>>({});
  useEffect(() => {
    let live = true;
    const pull = async () => {
      try { const s = await api<Summary>("/api/admin/summary"); if (live) setBadge({ Payments: s.health.awaiting_review, Refunds: s.needsRefund.length }); } catch { /* keep the last numbers */ }
    };
    pull();
    const t = setInterval(pull, 20_000);
    return () => { live = false; clearInterval(t); };
  }, [tab]);
  const startTour = (id?: string) => { const at = id ? steps.findIndex((s) => s.id === id) : 0; setTour(at < 0 ? 0 : at); };
  const endTour = (finished: boolean) => { setTour(null); setMenu(false); try { localStorage.setItem("y2k_tour_seen", finished ? "done" : "skipped"); } catch { /* private mode */ } };
  // On a phone the menu is a drawer. While the tour points at the menu, hold it open; for every other step, close it.
  const onStep = (target?: string) => setMenu(!!target && (target === "nav" || target === "hdr-links" || target.startsWith("tab-")));
  const groups = GROUPS.map((g) => ({ title: g.title, items: g.items.filter((i) => i.id !== "Analytics" || isSuper).map((i) => ({ id: i.id, label: i.id, icon: i.icon })) }));
  const toVerify = badge.Payments ?? 0;
  const toRefund = badge.Refunds ?? 0;
  const pills = (
    <>
      {toVerify > 0 && tab !== "Payments" && <button data-tour="tv-pill" onClick={() => setTab("Payments")} className="tnum inline-flex min-h-11 items-center gap-2 rounded-sm bg-crimson px-4 text-sm font-semibold text-fg">{toVerify} to verify <span aria-hidden="true">→</span></button>}
      {toRefund > 0 && tab !== "Refunds" && <button onClick={() => setTab("Refunds")} className="tnum inline-flex min-h-11 items-center gap-2 rounded-sm border border-blood px-4 text-sm font-semibold">{toRefund} to refund <span aria-hidden="true">→</span></button>}
    </>
  );
  return (
    <div className="calm min-h-dvh text-[15px] lg:flex">
      <AdminNav groups={groups} tab={tab} setTab={(id) => setTab(id as Tab)} badge={badge as Record<string, number>} name={name}
        collapsed={collapsed} setCollapsed={setCollapsed} open={menu} setOpen={setMenu} onTour={() => startTour()} />
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg px-3 lg:hidden">
          <button aria-label="Open menu" aria-expanded={menu} className="relative inline-flex size-11 items-center justify-center rounded-sm hover:bg-[var(--selected)]" onClick={() => setMenu(true)}>
            <Icon n="menu" />
            {(toVerify + toRefund) > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-crimson" />}
          </button>
          <span className="truncate text-base font-semibold">{tab}</span>
        </div>
        <main className="mx-auto w-full max-w-[1100px] px-5 pb-12 pt-5 md:px-8 lg:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 empty:hidden lg:min-h-11">
            <h1 className="hidden text-2xl lg:block">{tab}</h1>
            <div className="flex flex-wrap items-center gap-2">{pills}</div>
          </div>
          <p className="muted text-sm lg:mt-2">{TAB_HELP[tab]}</p>
          <div className="slide-up mt-4" key={tab}>
            {tab === "Overview" && <Overview go={setTab} onTour={() => startTour()} />}
            {tab === "Guide" && <Guide start={startTour} />}
            {tab === "Payments" && <Payments focusOrder={focusOrder} />}
            {tab === "Contacts" && <Contacts />}
            {tab === "Email update" && <EmailUpdate />}
            {tab === "Activity" && <Activity />}
            {tab === "Refunds" && <Refunds />}
            {tab === "Page text" && <PageText />}
            {tab === "Guests" && <Guests />}
            {tab === "Passes" && <Passes />}
            {tab === "Volunteers" && <Volunteers />}
            {tab === "Check-ins" && <Checkins />}
            {tab === "Tools" && <Tools />}
            {tab === "Analytics" && isSuper && <Analytics />}
          </div>
        </main>
      </div>
      {tour !== null && <Tour steps={steps} start={tour} tab={tab} setTab={(t) => setTab(t as Tab)} onStep={onStep} onClose={endTour} />}
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
const Stat = ({ k, v, tip }: { k: string; v: React.ReactNode; tip?: string }) => (
  <div className="card-plain relative min-w-[160px] flex-1 px-5 py-4">{tip && <span className="absolute right-3.5 top-3.5"><Tip text={tip} /></span>}<p className="label pr-6">{k}</p><p className="tnum mt-1.5 text-[32px] font-semibold">{v}</p></div>
);

function Overview({ go, onTour }: { go: (t: Tab) => void; onTour: () => void }) {
  const [seen, setSeen] = useState(true);
  useEffect(() => { try { setSeen(!!localStorage.getItem("y2k_tour_seen")); } catch { /* private mode */ } }, []);
  const { data: s, err, reload } = useLoad<Summary>("/api/admin/summary");
  useEffect(() => { const t = setInterval(() => reload(), 20_000); return () => clearInterval(t); }, [reload]);
  if (err) return <Err m={err} />;
  if (!s) return <div className="skeleton h-64" aria-busy="true" />;
  const attention = s.needsRefund.length + s.health.failed_emails + s.health.awaiting_review;
  return (
    <div className="flex flex-col gap-3">
      {!seen && (
        <section aria-label="Guided tour" className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="min-w-[240px] flex-1 text-[15px]"><strong className="font-semibold">New here?</strong> Take the 5-minute tour. It shows every screen and button you need on event day.</p>
          <span className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-calm min-h-11 px-5 text-sm" onClick={onTour}>Start the tour</button>
            <button className="btn btn-quiet btn-calm min-h-11 px-4 text-sm" onClick={() => { setSeen(true); try { localStorage.setItem("y2k_tour_seen", "dismissed"); } catch { /* private mode */ } }}>Not now</button>
          </span>
        </section>
      )}
      {attention > 0 && (
        <section data-tour="ov-attention" aria-label="Needs attention" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-blood bg-[var(--selected)] px-5 py-4">
          <p><strong className="font-semibold text-crimson">Needs attention:</strong> {s.health.awaiting_review} payments to verify · {s.needsRefund.length} orders need a refund · {s.health.failed_emails} failed emails</p>
          <button className="btn btn-calm min-h-11 text-sm" onClick={() => go(s.health.awaiting_review > 0 ? "Payments" : "Tools")}>Review</button>
        </section>
      )}
      <section data-tour="ov-counts" aria-label="Counts" className="flex flex-wrap gap-3">
        <Stat k="Tickets sold" v={s.counts.sold} tip="Tickets that have been paid for and approved by an admin. Orders still waiting for payment or review are not counted." />
        <Stat k="Still available" v={s.counts.left} tip="Passes you can still sell: total minus sold, minus seats temporarily held by buyers who haven't paid yet. Held seats come back automatically if the buyer doesn't send proof in time." />
        <Stat k="Checked in (people)" v={`${s.counts.checked_in_people}/${s.counts.people_expected}`} tip="People scanned in at the door, out of everyone expected. A couple pass counts as 2 people." />
        <Stat k="Pending orders" v={s.health.pending_orders} tip="Buyers who chose a pass and are still inside their hold time but haven't sent a UTR and screenshot yet. Nothing to do for these." />
      </section>
      <Money m={s.money} sold={s.counts.sold} go={go} />
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
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState("");
  const [undoing, setUndoing] = useState("");
  useEffect(() => { const t = setTimeout(() => reload(`/api/admin/guests?q=${encodeURIComponent(q)}`), 250); return () => clearTimeout(t); }, [q, reload]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg("");
    try { await fn(); setMsg(ok); reload(`/api/admin/guests?q=${encodeURIComponent(q)}`); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  const actions = (g: Guest) => (
    <>
      <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setEditing(editing === g.id ? "" : g.id)} aria-expanded={editing === g.id}>Edit details</button>
      {g.status === "used" && (undoing === g.id
        ? <>
            <button className="btn btn-primary btn-calm min-h-11 px-3 text-sm" onClick={() => { setUndoing(""); act(() => api(`/api/admin/tickets/${g.id}/undo-checkin`, {}), `${g.name} is marked as not checked in. The ticket can be scanned again.`); }}>Yes, undo check-in</button>
            <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setUndoing("")}>Cancel</button>
          </>
        : <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => setUndoing(g.id)}>Undo check-in</button>)}
      {g.orderId && <button className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" onClick={() => act(() => api(`/api/admin/orders/${g.orderId}/resend`, {}), "Email queued and sent")}>Resend email</button>}
    </>
  );
  const status = (g: Guest) => g.status === "used" ? `Used ${g.usedAt ? formatTimeIST(g.usedAt) : ""}` : g.status === "revoked" ? "Revoked" : "Valid";
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg">Guests<Tip text="Every issued ticket. Short code: the code printed under the QR; a volunteer can type it if the QR won't scan. Valid = not used yet. Used = already scanned in." /></h2>
        <div data-tour="gs-search" className="flex max-w-[520px] flex-[1_1_320px] flex-col gap-1.5">
          <label htmlFor="a-q" className="muted text-[13px]">Search name, phone, ticket ID, short code or Instagram</label>
          <input id="a-q" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </div>
      </div>
      <Err m={err} />
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      {/* Phones: one card per guest. */}
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {data?.map((g, gi) => (
          <li key={g.id} className="card-plain p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold">{g.name}{g.source === "comp" && <span className="muted font-normal"> · comp</span>}</p>
              <span className={`shrink-0 text-sm ${g.status === "revoked" ? "text-crimson" : "muted"}`}>{status(g)}</span>
            </div>
            <p className="muted tnum mt-1 text-[13px]">{g.shortCode} · {g.passName} ×{g.admits}</p>
            <p className="tnum mt-1 text-sm">{g.phone}{g.instagram ? <span className="muted"> · @{g.instagram}</span> : null}</p>
            <div data-tour={gi === 0 ? "gs-actions" : undefined} className="mt-3 flex flex-wrap gap-2">{actions(g)}</div>
            {editing === g.id && <GuestEdit g={g} cancel={() => setEditing("")} done={(m) => { setEditing(""); setMsg(m); reload(`/api/admin/guests?q=${encodeURIComponent(q)}`); }} />}
          </li>
        ))}
        {data?.length === 0 && <li className="muted py-4 text-sm">No guests match.</li>}
      </ul>
      {/* Desktop: table. */}
      <div className="mt-4 hidden overflow-x-auto rounded-sm border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-card text-left text-muted">{["Name", "Code", "Pass", "Phone", "Instagram", "Status", "Actions"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h === "Code" ? <span className="inline-flex items-center gap-1.5">{h}<Tip text="The short code under the ticket's QR. If a QR won't scan, the volunteer can find the guest with this." /></span> : h === "Actions" ? <span className="inline-flex items-center gap-1.5">{h}<Tip text="Resend email sends the ticket link to the buyer again. Use it if they say they never got it." /></span> : h}</th>)}</tr></thead>
          <tbody>
            {data?.map((g, gi) => (
              <Fragment key={g.id}>
              <tr className="border-t border-line align-top">
                <td className="px-4 py-3">{g.name}{g.source === "comp" && <span className="muted"> · comp</span>}</td>
                <td className="px-4 py-3 tnum">{g.shortCode}</td>
                <td className="px-4 py-3">{g.passName} <span className="muted">×{g.admits}</span></td>
                <td className="px-4 py-3 tnum">{g.phone}</td>
                <td className="px-4 py-3">{g.instagram ? `@${g.instagram}` : "—"}</td>
                <td className={`px-4 py-3 ${g.status === "revoked" ? "text-crimson" : ""}`}>{status(g)}</td>
                <td data-tour={gi === 0 ? "gs-actions" : undefined} className="flex flex-wrap gap-2 px-4 py-2">{actions(g)}</td>
              </tr>
              {editing === g.id && <tr><td colSpan={7} className="px-4 pb-4"><GuestEdit g={g} cancel={() => setEditing("")} done={(m) => { setEditing(""); setMsg(m); reload(`/api/admin/guests?q=${encodeURIComponent(q)}`); }} /></td></tr>}
              </Fragment>
            ))}
            {data?.length === 0 && <tr><td colSpan={7} className="muted px-4 py-6">No guests match.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GuestEdit({ g, done, cancel }: { g: Guest; done: (m: string) => void; cancel: () => void }) {
  const [f, setF] = useState({ name: g.name, phone: g.phone, email: g.email ?? "", instagram: g.instagram ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api(`/api/admin/tickets/${g.id}/edit`, { name: f.name, phone: f.phone, email: f.email || null, instagram: f.instagram || undefined });
      done(`Saved ${f.name}. If you changed the email, press Resend email so the ticket goes to the new address.`);
    } catch (er) { setErr(er instanceof Error ? er.message : "Failed"); setBusy(false); }
  }
  const id = (k: string) => `ge-${g.id}-${k}`;
  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-3 rounded-sm border border-line-strong p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">Edit details<Tip text="Fix a spelling mistake or a wrong number. The name here is what the volunteer sees at the door, so keep it the same as the guest's photo ID. The change is recorded in Activity." /></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1"><label className="label" htmlFor={id("n")}>Name on ticket</label><input id={id("n")} className="field" value={f.name} onChange={set("name")} autoComplete="off" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor={id("p")}>Mobile</label><input id={id("p")} className="field tnum" inputMode="tel" value={f.phone} onChange={set("phone")} autoComplete="off" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor={id("e")}>Email</label><input id={id("e")} className="field" type="email" value={f.email} onChange={set("email")} autoComplete="off" /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor={id("i")}>Instagram</label><input id={id("i")} className="field" value={f.instagram} onChange={set("instagram")} autoComplete="off" autoCapitalize="none" /></div>
      </div>
      {err && <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary btn-calm min-h-12 px-6" disabled={busy || f.name.trim().length < 2} aria-busy={busy}>{busy && <span className="spinner" aria-hidden="true" />}{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn btn-quiet btn-calm min-h-12 px-5" onClick={cancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

const rupees = (p: number) => String(p / 100);
const toIst = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16).replace(" ", "T") : "");
const fromIst = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

/** Emergency stop for the whole shop. Orders already placed and tickets already issued are not affected. */
function SalesSwitch() {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<{ paused: boolean }>("/api/admin/sales").then((s) => setPaused(s.paused)).catch((e) => setMsg(e instanceof Error ? e.message : "Failed")); }, []);
  async function toggle() {
    if (paused === null) return;
    if (!paused && !window.confirm("Pause ALL ticket sales? Nobody will be able to start a new order until you resume. Orders already placed are not affected.")) return;
    setBusy(true); setMsg("");
    try { setPaused((await api<{ paused: boolean }>("/api/admin/sales", { paused: !paused })).paused); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }
  return (
    <div className={`card-plain flex flex-wrap items-center justify-between gap-3 p-4 ${paused ? "!border-crimson" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-base font-semibold">{paused ? "Ticket sales are PAUSED" : "Ticket sales are on"}<Tip text="A master switch for the whole shop. Pause it if you spot a wrong price, the venue changes, or something is wrong with payments. While paused, nobody can start a new order; people who already ordered can still pay and get their tickets." /></p>
        <p className="muted text-sm">{paused ? "Visitors see the passes as not on sale." : "Visitors can buy passes that are on sale."}</p>
        {msg && <p role="alert" className="mt-1 text-sm text-danger">{msg}</p>}
      </div>
      <button className={`btn btn-calm min-h-12 px-6 ${paused ? "btn-primary" : "btn-quiet"}`} onClick={toggle} disabled={busy || paused === null} aria-busy={busy}>{busy && <span className="spinner" aria-hidden="true" />}{paused ? "Resume sales" : "Pause all sales"}</button>
    </div>
  );
}
const toPaise = (s: string) => Math.round(parseFloat(s || "0") * 100);

function Passes() {
  const { data, err, reload } = useLoad<Pass[]>("/api/admin/passes");
  const [msg, setMsg] = useState("");
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg">Passes<Tip text="Each row is one kind of ticket. Change the numbers and press Save. Buyers see the new price and availability within a few seconds." /></h2>
      <p className="muted mt-1 text-sm">Pick one admission (admits 1) or a couple pass (admits 2: each person gets their own QR). Prices in rupees.</p>
      <Err m={err} />{msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      <div className="mt-4" data-tour="ps-sales"><SalesSwitch /></div>
      <div className="mt-4 flex flex-col gap-3">
        {data?.map((p, pi) => <PassRow key={p.id} p={p} tour={pi === 0} onSaved={(m) => { setMsg(m); reload(); }} />)}
        <PassRow p={{ id: "", name: "", description: "", pricePaise: 0, feePaise: 0, totalQty: 0, admits: 1, active: false, sort: (data?.length ?? 0), sold: 0, salesStart: null, salesEnd: null }} fresh onSaved={(m) => { setMsg(m); reload(); }} />
      </div>
    </section>
  );
}

function PassRow({ p, fresh, tour, onSaved }: { p: Pass; fresh?: boolean; tour?: boolean; onSaved: (m: string) => void }) {
  const [f, setF] = useState({ name: p.name, description: p.description, price: rupees(p.pricePaise), fee: rupees(p.feePaise), total: String(p.totalQty), admits: String(p.admits), active: p.active, start: toIst(p.salesStart), end: toIst(p.salesEnd) });
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [m, setM] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function save() {
    setState("loading"); setM("");
    try {
      await api("/api/admin/passes", {
        id: p.id || undefined, name: f.name, description: f.description, pricePaise: toPaise(f.price), feePaise: toPaise(f.fee),
        totalQty: parseInt(f.total || "0", 10), admits: parseInt(f.admits || "1", 10), active: f.active, sort: p.sort, salesStart: fromIst(f.start), salesEnd: fromIst(f.end),
      });
      setState("ok"); onSaved(fresh ? "Pass added" : "Pass saved");
      if (fresh) setF({ name: "", description: "", price: "0", fee: "0", total: "0", admits: "1", active: false, start: "", end: "" });
      setTimeout(() => setState("idle"), 1500);
    } catch (e) { setState("error"); setM(e instanceof Error ? e.message : "Failed"); }
  }
  const cell = "flex flex-col gap-1";
  return (
    <div data-tour={tour ? "ps-row" : undefined} className={`card-plain flex flex-wrap items-end gap-3 p-4 ${fresh ? "border-dashed" : ""}`}>
      <div className={`${cell} min-w-[180px] flex-[2]`}><label className="label">{fresh ? "New pass name" : "Name"}</label><input className="field" value={f.name} onChange={set("name")} /></div>
      <div className={`${cell} min-w-[120px] flex-1`}><label className="label flex items-center gap-1.5">Price ₹<Tip text="What one pass costs, in rupees." /></label><input className="field" inputMode="decimal" value={f.price} onChange={set("price")} /></div>
      <div className={`${cell} min-w-[100px] flex-1`}><label className="label flex items-center gap-1.5">Fee ₹<Tip text="An extra charge added to each pass on top of the price. Leave 0 for none." /></label><input className="field" inputMode="decimal" value={f.fee} onChange={set("fee")} /></div>
      <div className={`${cell} min-w-[100px] flex-1`}><label className="label flex items-center gap-1.5">Total qty<Tip text="How many of this pass you will sell in total, including ones already sold. Raise it to sell more, lower it to stop earlier. The line below shows sold, held and left." /></label><input className="field" inputMode="numeric" value={f.total} onChange={set("total")} /></div>
      <div className="flex basis-full flex-wrap items-center gap-2" role="group" aria-label="Change total quantity">
        {[-10, -1, 1, 10].map((d) => (
          <button key={d} type="button" className="btn btn-quiet btn-calm min-h-11 px-4 text-sm tnum" onClick={() => setF({ ...f, total: String(Math.max(0, (parseInt(f.total || "0", 10) || 0) + d)) })}>{d > 0 ? `+${d}` : d}</button>
        ))}
        {!fresh && <span className="muted text-sm tnum">{p.sold} sold · {p.held ?? 0} held · {Math.max(0, (parseInt(f.total || "0", 10) || 0) - p.sold - (p.held ?? 0))} left. Save to apply.</span>}
      </div>
      <div className={`${cell} min-w-[90px] flex-1`}><label className="label flex items-center gap-1.5">Admits<Tip text="How many people one ticket lets in. 1 = a single pass. 2 = a couple pass: it is for two people and each gets their own QR code and ticket email." /></label><input className="field" inputMode="numeric" value={f.admits} onChange={set("admits")} /></div>
      <div className={`${cell} min-w-[200px] flex-1`}><label className="label flex items-center gap-1.5" htmlFor={`ss-${p.id || "new"}`}>Sales open (IST)<Tip text="Optional. The pass can only be bought from this date and time. Leave empty to start straight away." /></label><input id={`ss-${p.id || "new"}`} type="datetime-local" className="field" value={f.start} onChange={set("start")} /></div>
      <div className={`${cell} min-w-[200px] flex-1`}><label className="label flex items-center gap-1.5" htmlFor={`se-${p.id || "new"}`}>Sales close (IST)<Tip text="Optional. After this date and time the pass can no longer be bought, for example when an Early Bird offer ends. Leave empty for no end." /></label><input id={`se-${p.id || "new"}`} type="datetime-local" className="field" value={f.end} onChange={set("end")} /></div>
      <div className={`${cell} basis-full`}><label className="label">Description</label><input className="field" value={f.description} onChange={set("description")} /></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.active} onChange={set("active")} /> On sale <Tip text="Tick to show this pass on the website and let people buy it. Untick to hide it. Tickets already sold stay valid." /></label>
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
        <h2 className="flex items-center gap-1.5 text-lg">Staff accounts<Tip text="People who can log in. A volunteer can only use the scanner and look up guests. An admin can approve payments, edit passes, and manage staff." /></h2><Err m={err} />{msg && <p role="alert" className="mt-3 rounded-sm border border-danger p-3 text-sm">{msg}</p>}
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
      <form data-tour="vo-add" onSubmit={create} className="card-plain flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-4">
        <h2 className="text-lg">Add volunteer</h2>
        {(["name", "email"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1"><label className="label" htmlFor={`v-${k}`}>{k}</label>
            <input id={`v-${k}`} className="field" type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete="off" /></div>
        ))}
        <div className="flex flex-col gap-1"><label className="label flex items-center gap-1.5" htmlFor="v-password">password<Tip text="At least 10 characters. Generate makes an easy-to-read one. It is shown only once after you create the account, so copy it and send it privately." /></label>
          <div className="flex gap-2">
            <input id="v-password" className="field tnum min-w-0 flex-1" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
            <button type="button" className="btn btn-quiet btn-calm min-h-11 shrink-0 px-3 text-sm" onClick={() => setF({ ...f, password: genPassword() })}>Generate</button>
          </div></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--blood)]" checked={f.role === "admin"} onChange={(e) => setF({ ...f, role: e.target.checked ? "admin" : "volunteer" })} /> Make admin (full access) <Tip text="Leave unticked for door staff. Admins can see payments, phone numbers and exports, so only tick this for people you fully trust." /></label>
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
      <h2 className="flex items-center gap-1.5 text-lg">Recent check-ins<Tip text="Newest scans first. Lines in red were refused: duplicate = that ticket was already used, invalid = no such ticket, revoked = cancelled or refunded." /></h2><Err m={err} />
      <ul data-tour="ci-list" className="card-plain mt-3 divide-y divide-line">
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
  const health = useLoad<Summary>("/api/admin/summary");
  const [c, setC] = useState({ passTypeId: "", name: "", phone: "", email: "", instagram: "", reason: "" });
  const [comp, setComp] = useState<{ shortCode: string; token: string } | null>(null);

  async function issue(e: React.FormEvent) {
    e.preventDefault(); setBusy("comp"); setMsg(""); setComp(null);
    try { setComp(await api("/api/admin/tickets/comp", { ...c, email: c.email || null, instagram: c.instagram || undefined, passTypeId: c.passTypeId || passes.data?.[0]?.id })); setMsg("Comp ticket issued and written to the audit log."); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
    setBusy("");
  }
  async function retryEmails() {
    setBusy("mail"); setMsg("");
    try { const r = await api<{ retried: number }>("/api/admin/emails", {}); setMsg(r.retried ? `${r.retried} email${r.retried === 1 ? "" : "s"} sent again.` : "No failed emails to send."); health.reload(); }
    catch (er) { setMsg(er instanceof Error ? er.message : "Failed"); }
    setBusy("");
  }
  const dl = "btn btn-quiet btn-calm min-h-12 px-4 text-sm";
  const hm = health.data?.health;
  return (
    <section className="flex flex-wrap gap-6">
      <ShareLinks />
      <div data-tour="tl-emails" className="card-plain basis-full p-5">
        <h2 className="flex items-center gap-1.5 text-lg">Emails<Tip text="Tickets and updates are emailed automatically. If an email could not be delivered after several tries it is marked failed. Press Send failed emails again to try once more. Check the buyer's email address first (Guests, Edit details)." /></h2>
        <p className="muted mt-1 text-sm tnum">{hm ? `${hm.pending_emails} waiting to send · ${hm.failed_emails} failed` : "Loading…"}</p>
        <button className="btn btn-quiet btn-calm mt-3 min-h-12 px-5 text-sm" onClick={retryEmails} disabled={busy === "mail" || !hm?.failed_emails} aria-busy={busy === "mail"}>{busy === "mail" && <span className="spinner" aria-hidden="true" />}Send failed emails again</button>
      </div>
      <div data-tour="tl-export" className="card-plain min-w-[320px] flex-1 p-5">
        <h2 className="flex items-center gap-1.5 text-lg">Export &amp; print<Tip text="Excel (.xlsx) opens in Excel or Google Sheets. CSV is a plain file that opens anywhere. Print guest list makes a paper copy for the door in case phones fail." /></h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className={dl} href="/api/admin/export?kind=attendees&format=xlsx">Attendees .xlsx</a>
          <a className={dl} href="/api/admin/export?kind=attendees&format=csv">Attendees .csv</a>
          <a className={dl} href="/api/admin/export?kind=checkins&format=xlsx">Check-ins .xlsx</a>
          <a className={dl} href="/api/admin/export?kind=checkins&format=csv">Check-ins .csv</a>
          <a className={dl} href="/admin/print" target="_blank">Print guest list</a>
        </div>
        <p className="muted mt-4 text-[13px]">Exports contain full phone numbers and emails and are logged. Keep a copy on two admin phones before the event.</p>
      </div>
      <form data-tour="tl-comp" onSubmit={issue} className="card-plain flex min-w-[320px] flex-1 flex-col gap-3 p-5">
        <h2 className="flex items-center gap-1.5 text-lg">Issue comp ticket<Tip text="A free ticket you create yourself, for a guest, a friend or someone who paid you another way. It takes seats from the pass you choose, and it is recorded in the Activity log with your reason." /></h2>
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
