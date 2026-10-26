import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { summary } from "@/lib/admin";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await summary(), { headers: { "Cache-Control": "no-store" } });
  });
}
