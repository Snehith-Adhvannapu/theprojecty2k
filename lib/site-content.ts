// Landing page copy that admins can edit. Visitors still get a static page: saving revalidates "/" once.
// Falls back to the defaults (lib/landing-defaults.ts) if the table is missing or the database is unreachable.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { audit } from "@/lib/auth";
import { landingDefaults, type Landing } from "@/lib/landing-defaults";

export type { Landing, About } from "@/lib/landing-defaults";
export { landingDefaults } from "@/lib/landing-defaults";

const s = (max: number, min = 0) => z.string().trim().min(min).max(max);
const para = z.array(s(1500, 1)).max(8);

export const landingSchema = z.object({
  about: z.object({ heading: s(120, 2), lead: s(200), paras: para, closer: s(160), note: s(200) }),
  trust: z.array(s(160, 1)).length(3),
  how: z.object({ eyebrow: s(40), heading: s(120, 2), steps: z.array(z.object({ title: s(60, 1), text: s(300) })).length(4) }),
  last: z.object({ eyebrow: s(40), heading: s(120, 2), lead: s(200), paras: para }),
  details: z.array(z.object({ label: s(30, 1), value: s(120, 1) })).length(6),
  passes: z.object({ eyebrow: s(40), heading: s(120, 2), intro: s(400), steps: z.array(s(160, 1)).length(3) }),
  who: z.object({ eyebrow: s(40), heading: s(120, 2), paras: para }),
  faq: z.array(z.object({ q: s(200, 2), a: s(1200, 2) })).max(20),
});

const ensure = () => query("CREATE TABLE IF NOT EXISTS site_content (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");

export async function getLanding(): Promise<Landing> {
  try {
    await ensure();
    const rows = await query("SELECT key, value FROM site_content WHERE key IN ('landing','about')");
    const full = rows.find((r) => r.key === "landing");
    if (full) {
      const p = landingSchema.safeParse(full.value);
      if (p.success) return p.data;
    }
    // An earlier version saved only the hero text under 'about'.
    const old = rows.find((r) => r.key === "about");
    const d = landingDefaults();
    const pa = old ? landingSchema.shape.about.safeParse(old.value) : null;
    return pa?.success ? { ...d, about: pa.data } : d;
  } catch {
    return landingDefaults();
  }
}

export async function saveLanding(actorId: string, input: unknown): Promise<Landing> {
  const v = landingSchema.parse(input);
  await ensure();
  await query(
    "INSERT INTO site_content (key, value) VALUES ('landing', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(v)],
  );
  await audit(actorId, "landing_text_edited", "landing");
  try { revalidatePath("/"); } catch { /* not in a request context (tests) */ }
  return v;
}

/** Back to the original wording. */
export async function resetLanding(actorId: string): Promise<Landing> {
  await ensure();
  await query("DELETE FROM site_content WHERE key IN ('landing','about')");
  await audit(actorId, "landing_text_reset", "landing");
  try { revalidatePath("/"); } catch { /* not in a request context (tests) */ }
  return landingDefaults();
}
