import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { analyticsSummary, type Range } from "@/lib/analytics";

const q = z.object({ days: z.enum(["1", "7", "30", "90"]).default("7") });

// Superadmin only: traffic is the owner's business, not every admin's.
export async function GET(req: Request) {
  return handle(async () => {
    await requireRole("superadmin");
    const { days } = q.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await analyticsSummary(Number(days) as Range), { headers: { "Cache-Control": "no-store" } });
  });
}
