import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const s = await requireRole("volunteer");
    return ok({ name: s.name, role: s.role }, { headers: { "Cache-Control": "no-store" } });
  });
}
