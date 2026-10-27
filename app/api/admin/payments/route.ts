import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { reviewQueue } from "@/lib/payments/manual";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await reviewQueue(), { headers: { "Cache-Control": "no-store" } });
  });
}
