import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { checkinHistory } from "@/lib/admin";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await checkinHistory(200), { headers: { "Cache-Control": "no-store" } });
  });
}
