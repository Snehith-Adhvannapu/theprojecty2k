"use client";
// Superadmin only: site traffic and the visit-to-ticket funnel. Counts come from our own database; nothing leaves the site.
import { useCallback, useEffect, useRef, useState } from "react";
import { Tip } from "@/components/Tip";
import { api } from "./api";

interface Row { label: string; views: number; visitors: number }
interface Pt { label: string; views: number; visitors: number }
interface Data {
  days: number;
  totals: { views: number; visitors: number; live: number; today: number };
  daily: Pt[];
  pages: Row[]; sources: Row[]; countries: Row[]; cities: Row[]; devices: Row[]; browsers: Row[];
  funnel: { label: string; n: number }[];
}

const RANGES: [number, string][] = [[1, "24 hours"], [7, "7 days"], [30, "30 days"], [90, "90 days"]];
const nf = new Intl.NumberFormat("en-IN");
const COUNTRY = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const country = (c: string) => { try { return COUNTRY?.of(c) ?? c; } catch { return c; } };

function Stat({ k, v, tip, sub }: { k: string; v: React.ReactNode; tip: string; sub?: string }) {
  return (
    <div className="card-plain relative min-w-[160px] flex-1 px-5 py-4">
      <span className="absolute right-3.5 top-3.5"><Tip text={tip} /></span>
      <p className="label pr-6">{k}</p>
      <p className="tnum mt-1.5 text-[32px] font-semibold">{v}</p>
      {sub && <p className="muted text-[13px]">{sub}</p>}
    </div>
  );
}

function Block({ title, tip, children, solo }: { title: string; tip: string; children: React.ReactNode; solo?: boolean }) {
  return (
    <section className={`card-plain min-w-0 p-5 ${solo ? "w-full" : "flex-1 basis-[320px]"}`}>
      <h2 className="flex items-center gap-1.5 text-lg">{title}<Tip text={tip} /></h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One line per item with a bar sized against the biggest. */
function BarList({ rows, fmt }: { rows: Row[]; fmt?: (l: string) => string }) {
  if (rows.length === 0) return <p className="muted text-sm">No visits in this period yet.</p>;
  const max = Math.max(...rows.map((r) => r.views), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{fmt ? fmt(r.label) : r.label}</span>
            <span className="tnum shrink-0"><strong className="font-semibold">{nf.format(r.views)}</strong> <span className="muted text-[13px]">· {nf.format(r.visitors)} {r.visitors === 1 ? "visitor" : "visitors"}</span></span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-sm bg-line" aria-hidden="true"><div className="h-full rounded-sm bg-crimson" style={{ width: `${Math.max(3, (r.views / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** A round top value for the y axis, divisible by 4 so every gridline is a whole number. */
function niceMax(v: number) {
  const raw = Math.max(v, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw) ?? raw;
  return Math.ceil(step) * 4;
}

/** Two lines (page views, visitors) with real numbers: labelled gridlines, a value on every view point when there are few,
 *  and a readout for the exact day or hour when you hover or touch the chart. */
function LineChart({ data }: { data: Pt[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const H = 240, m = { l: 42, r: 16, t: 22, b: 30 };
  const n = data.length;
  const max = niceMax(Math.max(...data.map((x) => x.views), 1));
  const iw = Math.max(w - m.l - m.r, 10), ih = H - m.t - m.b;
  const x = (i: number) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const line = (k: "views" | "visitors") => data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const every = Math.max(1, Math.ceil((n * 58) / iw)); // keep x labels about 58px apart so none overlap
  const pick = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setHi(Math.min(n - 1, Math.max(0, Math.round(((ev.clientX - r.left - m.l) / iw) * (n - 1)))));
  };
  const p = hi === null ? null : data[hi];

  return (
    <div ref={box} className="relative w-full">
      <div className="muted mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" aria-hidden="true">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-crimson" />Page views</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t-2 border-dashed border-chrome" />Visitors</span>
      </div>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={`Line graph of page views and visitors. Highest value ${max}. Exact numbers are in the table below.`}
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={(ev) => { if (ev.pointerType === "mouse") setHi(null); }} style={{ touchAction: "pan-y" }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (max * i) / 4;
            return (
              <g key={i}>
                <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--fg-muted)" className="tnum">{nf.format(v)}</text>
              </g>
            );
          })}
          {data.map((q, i) => {
            const last = i === n - 1;
            if (!(last || (i % every === 0 && n - 1 - i >= every * 0.6))) return null;
            return <text key={i} x={x(i)} y={H - 8} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && last ? "end" : "middle"} fontSize={12} fill="var(--fg-muted)">{q.label}</text>;
          })}
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={m.t + ih} stroke="var(--border-strong)" strokeWidth={1} />}
          <path d={line("visitors")} fill="none" stroke="var(--chrome)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line("views")} fill="none" stroke="var(--crimson)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {n <= 31 && data.map((q, i) => <circle key={i} cx={x(i)} cy={y(q.views)} r={hi === i ? 5 : 3} fill="var(--bg)" stroke="var(--crimson)" strokeWidth={2} />)}
          {n <= 12 && data.map((q, i) => q.views > 0 && (
            <text key={i} x={x(i)} y={y(q.views) - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--fg)" className="tnum">{nf.format(q.views)}</text>
          ))}
          {hi !== null && n <= 31 && <circle cx={x(hi)} cy={y(data[hi].visitors)} r={4} fill="var(--bg)" stroke="var(--chrome)" strokeWidth={2} />}
        </svg>
      )}
      {p && hi !== null && (
        <div role="status" className="card tnum pointer-events-none absolute z-10 w-40 px-3 py-2 text-[13px]" style={{ top: 34, left: Math.min(Math.max(x(hi) - 80, 0), Math.max(w - 160, 0)) }}>
          <p className="font-semibold">{p.label}</p>
          <p><span className="text-crimson">●</span> {nf.format(p.views)} page views</p>
          <p><span className="text-chrome">●</span> {nf.format(p.visitors)} visitors</p>
        </div>
      )}
      <details className="mt-3">
        <summary className="muted inline-flex min-h-11 cursor-pointer items-center text-sm hover:text-fg">Show the exact numbers</summary>
        <div className="mt-1 max-h-64 overflow-auto rounded-sm border border-line">
          <table className="tnum w-full border-collapse text-sm">
            <thead><tr className="bg-card text-left text-muted"><th scope="col" className="px-3 py-2 font-medium">{n > 0 && data[0].label.includes(":") ? "Hour" : "Day"}</th><th scope="col" className="px-3 py-2 text-right font-medium">Page views</th><th scope="col" className="px-3 py-2 text-right font-medium">Visitors</th></tr></thead>
            <tbody>{[...data].reverse().map((q) => <tr key={q.label} className="border-t border-line"><th scope="row" className="px-3 py-2 text-left font-normal">{q.label}</th><td className="px-3 py-2 text-right">{nf.format(q.views)}</td><td className="px-3 py-2 text-right">{nf.format(q.visitors)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function Analytics() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async (n = days) => {
    try { setD(await api<Data>(`/api/admin/analytics?days=${n}`)); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }, [days]);
  useEffect(() => { load(); const t = setInterval(() => load(), 30_000); return () => clearInterval(t); }, [load]);

  if (err && !d) return <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{err}</p>;
  if (!d) return <div className="skeleton h-64" aria-busy="true" />;

  const f = d.funnel;
  const buy = f[0].n > 0 ? ((f[4].n / f[0].n) * 100).toFixed(1) : "0";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
        {RANGES.map(([n, l]) => (
          <button key={n} className={`btn btn-quiet btn-calm min-h-11 px-4 text-sm ${days === n ? "!border-crimson" : ""}`} aria-pressed={days === n} onClick={() => { setDays(n); setD(null); load(n); }}>{l}</button>
        ))}
        <button className="muted inline-flex min-h-11 items-center px-2 text-sm hover:text-fg" onClick={() => load()}>Refresh</button>
      </div>

      <section aria-label="Totals" className="flex flex-wrap gap-3">
        <Stat k="Page views" v={nf.format(d.totals.views)} tip="Every time someone opens a page on the site in this period. One person opening 3 pages counts as 3." sub={`${nf.format(d.totals.today)} today`} />
        <Stat k="Visitors" v={nf.format(d.totals.visitors)} tip="People who visited, counted once per day. We never store IP addresses or use cookies, so someone who returns on another day counts again." />
        <Stat k="On the site now" v={nf.format(d.totals.live)} tip="People who opened a page in the last 5 minutes." />
        <Stat k="Visit to ticket" v={`${buy}%`} tip="Of the people who visited the landing page, the share who ended up with an approved ticket." sub={`${nf.format(f[4].n)} paid of ${nf.format(f[0].n)}`} />
      </section>

      <Block solo title={days === 1 ? "Views by hour" : "Views per day"} tip="Red line: page views. Dashed line: visitors. Hover or touch the graph to read the exact numbers for a day or hour (India time). Every period is shown, including ones with no visits.">
        <LineChart data={d.daily} />
      </Block>

      <Block solo title="From visit to ticket" tip="How many people reach each step. The percentage is the share of the step before. Big drops show where people give up.">
        <ol className="flex flex-col gap-3">
          {f.map((s, i) => {
            const prev = i === 0 ? null : f[i - 1].n;
            const top = Math.max(f[0].n, f[1].n, f[2].n, 1);
            return (
              <li key={s.label} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{i + 1}. {s.label}</span>
                  <span className="tnum"><strong className="font-semibold">{nf.format(s.n)}</strong>{prev ? <span className="muted text-[13px]"> · {prev > 0 ? Math.round((s.n / prev) * 100) : 0}% of previous</span> : null}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-sm bg-line" aria-hidden="true"><div className="h-full rounded-sm bg-crimson" style={{ width: `${Math.max(2, Math.min(100, (s.n / top) * 100))}%` }} /></div>
              </li>
            );
          })}
        </ol>
        <p className="muted mt-4 text-[13px]">Visitors are counted per day, while orders and payments are exact counts from your orders. Treat the first rows as a close estimate.</p>
      </Block>

      <div className="flex flex-wrap gap-4">
        <Block title="Top pages" tip="The pages people open most. Ticket and order pages are grouped so private links are never stored."><BarList rows={d.pages} /></Block>
        <Block title="Where they came from" tip="The site or app that sent the visitor. Direct means they typed the address, or came from an app that hides it. Add ?utm_source=instagram to a link you share to track it by name."><BarList rows={d.sources} /></Block>
      </div>
      <div className="flex flex-wrap gap-4">
        <Block title="Countries" tip="Where visitors are, worked out from their network. It is only filled in on the live site."><BarList rows={d.countries} fmt={(l) => (/^[A-Z]{2}$/.test(l) ? country(l) : l)} /></Block>
        <Block title="Cities" tip="The nearest city to the visitor. It is approximate, and some visitors have none."><BarList rows={d.cities} /></Block>
      </div>
      <div className="flex flex-wrap gap-4">
        <Block title="Devices" tip="Phone, computer or tablet."><BarList rows={d.devices} /></Block>
        <Block title="Browsers and apps" tip="What they opened the site in. Instagram app means they tapped your link inside Instagram."><BarList rows={d.browsers} /></Block>
      </div>
      <p className="muted text-[13px]">Private by design: no cookies, no IP addresses stored, staff screens and bots are not counted, and visitors who send Do Not Track are skipped.</p>
    </div>
  );
}
