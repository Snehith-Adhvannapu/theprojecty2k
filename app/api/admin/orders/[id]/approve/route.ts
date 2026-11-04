import { z } from "zod";
import { fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { approveOrder } from "@/lib/payments/manual";
import { flushOutbox } from "@/lib/email";
import { query } from "@/lib/db";
import { ticketsForOrder } from "@/lib/tickets";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    const r = await approveOrder(id, staff.id);
    await flushOutbox(id).catch(() => {});
    // What the admin needs for the "approved" pop-up: did the email go, and the ticket links for WhatsApp.
    if (r.result !== "approved" && r.result !== "already_approved") return ok(r);
    const [mail] = await query("SELECT status FROM email_outbox WHERE order_id = $1 AND kind = 'ticket' ORDER BY created_at DESC LIMIT 1", [id]);
    const tokens = (await ticketsForOrder({ query }, id)).map((t) => t.token);
    return ok({ ...r, emailSent: mail?.status === "sent", tokens });
  });
}
