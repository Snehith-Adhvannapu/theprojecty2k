import { eventConfig } from "@/config/event";
import { listPublicPasses, type PublicPass } from "@/lib/inventory";

let cache: { at: number; passes: PublicPass[] } | null = null;

/** 5s in-process cache so an Instagram burst never fans out to the database. */
export async function cachedPasses(): Promise<PublicPass[]> {
  if (cache && Date.now() - cache.at < 5000) return cache.passes;
  const passes = await listPublicPasses();
  cache = { at: Date.now(), passes };
  return passes;
}

export const publicEvent = () => ({
  name: eventConfig.name,
  dateLabel: eventConfig.dateLabel,
  maxPerOrder: eventConfig.limits.maxPassesPerOrder,
});
