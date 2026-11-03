// A master "pause ticket sales" switch for admins (emergency stop: wrong price, venue change, payment trouble).
// Stored in site_content so it needs no migration. Pausing never touches orders already placed or tickets already issued.
import { query } from "@/lib/db";
import { audit } from "@/lib/auth";

const ensure = () => query("CREATE TABLE IF NOT EXISTS site_content (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");

export async function getSales(): Promise<{ paused: boolean }> {
  try {
    await ensure();
    const [r] = await query("SELECT value FROM site_content WHERE key = 'sales'");
    return { paused: r?.value?.paused === true };
  } catch {
    return { paused: false }; // never block checkout because this lookup failed
  }
}

export async function setSalesPaused(actorId: string, paused: boolean) {
  await ensure();
  await query(
    "INSERT INTO site_content (key, value) VALUES ('sales', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify({ paused })],
  );
  await audit(actorId, paused ? "sales_paused" : "sales_resumed", null);
  return { paused };
}
