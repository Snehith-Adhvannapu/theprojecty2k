import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { reconcile } from "@/lib/admin";
import { flushOutbox } from "@/lib/email";

export async function POST() {
  return handle(async () => {
    const staff = await requireRole("admin");
    const r = await reconcile(staff.id);
    await flushOutbox();
    return ok(r);
  });
}
