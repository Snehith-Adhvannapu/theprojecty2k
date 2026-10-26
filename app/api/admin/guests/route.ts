import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { searchGuests } from "@/lib/admin";

export async function GET(req: Request) {
  return handle(async () => {
    await requireRole("admin");
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok(await searchGuests(q.slice(0, 80)), { headers: { "Cache-Control": "no-store" } });
  });
}
