// First-party page analytics for the superadmin. No cookies, no third-party scripts, and no IP addresses are stored.
// A visitor is a one-way hash of IP + browser + day, so the same person on a later day counts as a new visitor.
// Secret paths (/t/<token>, /order/<id>) are collapsed before anything is written.
import { createHash } from "node:crypto";
import { z } from "zod";
import { query } from "@/lib/db";

export const trackInput = z.object({
  path: z.string().min(1).max(200),
  ref: z.string().max(500).optional(),
  utm: z.string().max(60).optional(),
});

const SKIP = /^\/(admin|scan|login|api|_next)(\/|$)/;

/** A path that is safe to store, or null when it shouldn't be tracked. */
export function cleanPath(raw: string): string | null {
  let p = raw.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) return null;
  if (SKIP.test(p)) return null;
  p = p.replace(/^\/t\/[^/]+/, "/t/*").replace(/^\/order\/[^/]+/, "/order/*");
  p = p.replace(/\/+$/, "") || "/";
  return p.slice(0, 100);
}

const ALIAS: Record<string, string> = {
  "l.instagram.com": "instagram.com", "lm.instagram.com": "instagram.com", "l.facebook.com": "facebook.com", "lm.facebook.com": "facebook.com",
  "m.facebook.com": "facebook.com", "t.co": "twitter.com", "x.com": "twitter.com", "away.vk.com": "vk.com", "wa.me": "whatsapp.com", "api.whatsapp.com": "whatsapp.com",
};

/** Where the visit came from: ?utm_source=, else the referring site, else Direct. Own-site referrals are ignored. */
export function sourceOf(ref: string | undefined, utm: string | undefined, ownHost: string): string | null {
  const u = utm?.trim().toLowerCase().replace(/[^a-z0-9._ -]/g, "").slice(0, 40);
  if (u) return u;
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
    const own = ownHost.replace(/^www\./, "").split(":")[0].toLowerCase();
    if (!h || h === own) return null;
    return ALIAS[h] ?? h;
  } catch { return null; }
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|uptime|curl|wget|python|node-fetch|axios|vercel/i;

export function readAgent(ua: string): { device: string; browser: string } | null {
  if (!ua || BOT.test(ua)) return null;
  const device = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop";
  const browser = /Instagram/i.test(ua) ? "Instagram app" : /FBAN|FBAV/i.test(ua) ? "Facebook app"
    : /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  return { device, browser };
}

const visitorId = (ip: string, ua: string) =>
  createHash("sha256").update(`${ip}|${ua}|${new Date().toISOString().slice(0, 10)}|${process.env.AUTH_SECRET ?? "y2k"}`).digest("hex").slice(0, 16);

export async function recordView(input: z.infer<typeof trackInput>, ctx: { ip: string; ua: string; host: string; country?: string | null; city?: string | null }) {
  const path = cleanPath(input.path);
  const agent = readAgent(ctx.ua);
  if (!path || !agent) return false;
  const city = ctx.city ? decodeURIComponent(ctx.city).slice(0, 60) : null;
  await query(
    "INSERT INTO page_views (path, source, visitor, country, city, device, browser) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [path, sourceOf(input.ref, input.utm, ctx.host), visitorId(ctx.ip, ctx.ua), ctx.country?.slice(0, 2).toUpperCase() || null, city, agent.device, agent.browser],
  );
  return true;
}

export type Range = 1 | 7 | 30 | 90;
type Row = { label: string; views: number; visitors: number };

export async function analyticsSummary(days: Range = 7) {
  const since = `now() - make_interval(days => $1)`;
  const top = async (col: string, limit = 8): Promise<Row[]> =>
    (await query(
      `SELECT COALESCE(${col}, 'Direct / unknown') AS label, count(*)::int AS views, count(DISTINCT visitor)::int AS visitors
         FROM page_views WHERE at >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`, [days],
    )).map((r) => ({ label: r.label as string, views: r.views as number, visitors: r.visitors as number }));

  const [tot] = await query(
    `SELECT count(*)::int AS views,
            (SELECT count(DISTINCT (visitor, (at AT TIME ZONE 'Asia/Kolkata')::date)) FROM page_views WHERE at >= ${since})::int AS visitors,
            (SELECT count(DISTINCT visitor) FROM page_views WHERE at >= now() - interval '5 minutes')::int AS live,
            (SELECT count(*) FROM page_views WHERE (at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS today
       FROM page_views WHERE at >= ${since}`, [days],
  );
  const daily = (await query(
    `SELECT to_char((at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS d, count(*)::int AS views, count(DISTINCT visitor)::int AS visitors
       FROM page_views WHERE at >= ${since} GROUP BY 1 ORDER BY 1`, [days],
  )).map((r) => ({ day: r.d as string, views: r.views as number, visitors: r.visitors as number }));

  const [f] = await query(
    `SELECT (SELECT count(DISTINCT visitor) FROM page_views WHERE at >= ${since} AND path = '/')::int AS landing,
            (SELECT count(DISTINCT visitor) FROM page_views WHERE at >= ${since} AND path = '/checkout')::int AS checkout,
            (SELECT count(*) FROM orders WHERE created_at >= ${since})::int AS orders,
            (SELECT count(*) FROM orders WHERE submitted_at >= ${since})::int AS proofs,
            (SELECT count(*) FROM orders WHERE paid_at >= ${since})::int AS paid`, [days],
  );

  return {
    days,
    totals: { views: tot.views as number, visitors: tot.visitors as number, live: tot.live as number, today: tot.today as number },
    daily,
    pages: await top("path", 10),
    sources: await top("source"),
    countries: await top("country"),
    cities: await top("city"),
    devices: await top("device"),
    browsers: await top("browser"),
    funnel: [
      { label: "Visited the landing page", n: f.landing as number },
      { label: "Opened checkout", n: f.checkout as number },
      { label: "Started an order", n: f.orders as number },
      { label: "Sent payment proof", n: f.proofs as number },
      { label: "Paid and approved", n: f.paid as number },
    ],
  };
}
