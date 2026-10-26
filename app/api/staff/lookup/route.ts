import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { lookupGuests } from "@/lib/checkin";

export async function GET(req: Request) {
  return handle(async () => {
    await requireRole("volunteer");
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok(await lookupGuests(q.slice(0, 60)), { headers: { "Cache-Control": "no-store" } });
  });
}
