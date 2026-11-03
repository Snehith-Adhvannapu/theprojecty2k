// Landing page copy that admins can edit. Visitors still get a static page: saving revalidates "/" once.
// Falls back to the defaults in config/event.ts if the table is missing or the database is unreachable.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eventConfig } from "@/config/event";
import { query } from "@/lib/db";
import { audit } from "@/lib/auth";

export interface About { heading: string; lead: string; paras: string[]; closer: string; note: string }

export const DEFAULT_NOTE = "Pay by UPI · PDF ticket by email once verified · Non-refundable, no re-entry";
export const defaultAbout = (): About => ({ ...eventConfig.about, paras: [...eventConfig.about.paras], note: DEFAULT_NOTE });

export const aboutSchema = z.object({
  heading: z.string().trim().min(2, "Add a heading").max(120),
  lead: z.string().trim().max(200),
  paras: z.array(z.string().trim().min(1).max(1200)).max(8),
  closer: z.string().trim().max(160),
  note: z.string().trim().max(200),
});

const ensure = () => query("CREATE TABLE IF NOT EXISTS site_content (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");

export async function getAbout(): Promise<About> {
  try {
    await ensure();
    const [r] = await query("SELECT value FROM site_content WHERE key = 'about'");
    if (!r) return defaultAbout();
    const p = aboutSchema.safeParse(r.value);
    return p.success ? p.data : defaultAbout();
  } catch {
    return defaultAbout();
  }
}

export async function saveAbout(actorId: string, input: unknown): Promise<About> {
  const v = aboutSchema.parse(input);
  await ensure();
  await query(
    "INSERT INTO site_content (key, value) VALUES ('about', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(v)],
  );
  await audit(actorId, "landing_text_edited", "about");
  try { revalidatePath("/"); } catch { /* not in a request context (tests) */ }
  return v;
}

/** Back to the original wording. */
export async function resetAbout(actorId: string): Promise<About> {
  await ensure();
  await query("DELETE FROM site_content WHERE key = 'about'");
  await audit(actorId, "landing_text_reset", "about");
  try { revalidatePath("/"); } catch { /* not in a request context (tests) */ }
  return defaultAbout();
}
