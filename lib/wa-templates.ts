// Admin-editable WhatsApp presets, stored in site_content. Falls back to the defaults per message.
import { z } from "zod";
import { query } from "@/lib/db";
import { audit } from "@/lib/auth";
import { WA_DEFAULTS, type WaTemplates } from "@/lib/wa-fill";

const msg = z.string().trim().min(5).max(1000);
export const waTemplatesSchema = z.object({ fix: msg, reject: msg, refund: msg });

const ensure = () => query("CREATE TABLE IF NOT EXISTS site_content (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");

export async function getWaTemplates(): Promise<WaTemplates> {
  try {
    await ensure();
    const [row] = await query("SELECT value FROM site_content WHERE key = 'wa_templates'");
    const p = z.object({ fix: msg.optional(), reject: msg.optional(), refund: msg.optional() }).safeParse(row?.value ?? {});
    return { ...WA_DEFAULTS, ...(p.success ? Object.fromEntries(Object.entries(p.data).filter(([, v]) => v)) : {}) };
  } catch {
    return { ...WA_DEFAULTS };
  }
}

export async function saveWaTemplates(actorId: string, input: unknown): Promise<WaTemplates> {
  const v = waTemplatesSchema.parse(input);
  await ensure();
  await query(
    "INSERT INTO site_content (key, value) VALUES ('wa_templates', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify(v)],
  );
  await audit(actorId, "wa_templates_edited", "wa_templates");
  return v;
}
