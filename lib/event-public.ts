import { eventConfig } from "@/config/event";
import { query } from "@/lib/db";
import { listPublicPasses, type PublicPass } from "@/lib/inventory";

let cache: { at: number; passes: PublicPass[] } | null = null;

/** 5s in-process cache so an Instagram burst never fans out to the database. */
export async function cachedPasses(): Promise<PublicPass[]> {
  if (cache && Date.now() - cache.at < 5000) return cache.passes;
  const passes = await listPublicPasses();
  cache = { at: Date.now(), passes };
  return passes;
}

let pulseCache: { at: number; v: { passes24h: number; lastMinutes: number | null } } | null = null;

/** Passes approved in the last 24 hours and how long ago the latest one was. Counts only, nothing about who. Cached 60s. */
export async function recentPulse() {
  if (pulseCache && Date.now() - pulseCache.at < 60_000) return pulseCache.v;
  const [r] = await query(`
    SELECT COALESCE(SUM(oi.qty), 0)::int AS n, (SELECT floor(extract(epoch FROM now() - max(paid_at)) / 60)::int FROM orders WHERE status = 'paid') AS last
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'paid' AND o.paid_at > now() - interval '24 hours'`);
  const v = { passes24h: r.n as number, lastMinutes: r.last === null ? null : Math.max(0, r.last as number) };
  pulseCache = { at: Date.now(), v };
  return v;
}

export const publicEvent = () => ({
  name: eventConfig.name,
  dateLabel: eventConfig.dateLabel,
  maxPerOrder: eventConfig.limits.maxPassesPerOrder,
  bookingFeePaise: eventConfig.bookingFeePaise,
});
