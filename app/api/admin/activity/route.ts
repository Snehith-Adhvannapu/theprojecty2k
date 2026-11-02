import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { activityLog } from "@/lib/admin/contacts";

export async function GET() {
  return handle(async () => {
    const staff = await requireRole("admin");
    return ok(await activityLog(staff.role), { headers: { "Cache-Control": "no-store" } });
  });
}
