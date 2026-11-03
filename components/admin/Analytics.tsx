"use client";
// Superadmin only: site traffic and the visit-to-ticket funnel. Counts come from our own database; nothing leaves the site.
import { useCallback, useEffect, useState } from "react";
import { Tip } from "@/components/Tip";
import { api } from "./api";

interface Row { label: string; views: number; visitors: number }
interface Data {
  days: number;
  totals: { views: number; visitors: number; live: number; today: number };
  daily: { day: string; views: number; visitors: number }[];
  pages: Row[]; sources: Row[]; countries: Row[]; cities: Row[]; devices: Row[]; browsers: Row[];
  funnel: { label: string; n: number }[];
}

const RANGES: [number, string][] = [[1, "24 hours"], [7, "7 days"], [30, "30 days"], [90, "90 days"]];
const nf = new Intl.NumberFormat("en-IN");
const dayLabel = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
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

  const peak = Math.max(...d.daily.map((x) => x.views), 1);
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

      <Block solo title="Views per day" tip="One bar per day (India time). Taller means more page views. Hover or tap a bar for the numbers.">
        {d.daily.length === 0 ? <p className="muted text-sm">No visits in this period yet.</p> : (
          <>
            <div className="flex h-40 items-end justify-center gap-[3px]" role="img" aria-label={`Daily page views, highest ${peak}`}>
              {d.daily.map((x) => (
                <div key={x.day} className="group relative flex h-full min-w-0 max-w-12 flex-1 items-end" title={`${dayLabel(x.day)}: ${x.views} views, ${x.visitors} visitors`}>
                  <div className="w-full rounded-t-sm bg-crimson transition-colors group-hover:bg-fg" style={{ height: `${Math.max(2, (x.views / peak) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="muted tnum mt-2 flex justify-between text-[13px]"><span>{dayLabel(d.daily[0].day)}</span><span>{dayLabel(d.daily[d.daily.length - 1].day)}</span></div>
          </>
        )}
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
