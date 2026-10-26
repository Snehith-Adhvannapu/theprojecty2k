import { z } from "zod";
import { fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { resendTicketEmail } from "@/lib/admin";
import { flushOutbox } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Not found.", 404);
    await resendTicketEmail(staff.id, id);
    await flushOutbox(id);
    return ok({});
  });
}
