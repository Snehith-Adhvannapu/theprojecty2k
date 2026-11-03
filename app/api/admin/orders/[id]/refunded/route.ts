import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { markRefunded, refundInput } from "@/lib/payments/manual";
import { flushOutbox } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    const d = await body(req, refundInput);
    await markRefunded(id, staff.id, d);
    await flushOutbox(id).catch(() => {});
    return ok({});
  });
}
