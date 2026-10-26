import { z } from "zod";
import { fail, handle, ok } from "@/lib/api";
import { getOrderStatus } from "@/lib/payments";
import { flushOutbox } from "@/lib/email";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    const s = await getOrderStatus(id);
    if (!s) return fail("NOT_FOUND", "Order not found.", 404);
    if (s.status === "paid") await flushOutbox(id); // retry any unsent ticket email on the next hit
    return ok(s, { headers: { "Cache-Control": "no-store" } });
  });
}
