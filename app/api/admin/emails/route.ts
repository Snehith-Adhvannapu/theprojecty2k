import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { retryFailedEmails } from "@/lib/admin";
import { flushOutbox } from "@/lib/email";

export async function POST() {
  return handle(async () => {
    const staff = await requireRole("admin");
    const retried = await retryFailedEmails(staff.id);
    await flushOutbox();
    return ok({ retried });
  });
}
