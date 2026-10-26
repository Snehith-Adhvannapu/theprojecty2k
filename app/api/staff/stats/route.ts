import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

// Volunteer-safe: two counts, nothing personal.
export async function GET() {
  return handle(async () => {
    await requireRole("volunteer");
    const [r] = await query(
      `SELECT count(*) FILTER (WHERE status = 'used')::int AS checked_in,
              count(*) FILTER (WHERE status IN ('valid','used'))::int AS expected FROM tickets`,
    );
    return ok({ checkedIn: r.checked_in, expected: r.expected }, { headers: { "Cache-Control": "no-store" } });
  });
}
