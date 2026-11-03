import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { rejectOrder } from "@/lib/payments/manual";
import { flushOutbox } from "@/lib/email";

const schema = z.object({ reason: z.string(), resubmit: z.boolean(), refund: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    const d = await body(req, schema);
    const r = await rejectOrder(id, staff.id, d.reason, d.resubmit, !!d.refund && !d.resubmit);
    await flushOutbox(id).catch(() => {});
    return ok(r);
  });
}
