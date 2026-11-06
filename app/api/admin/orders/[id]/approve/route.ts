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
    const mails = await query("SELECT to_email, status FROM email_outbox WHERE order_id = $1 AND kind = 'ticket'", [id]);
    const tickets = await ticketsForOrder({ query }, id);
    const holders = await query("SELECT id, holder_name, holder_phone FROM tickets WHERE order_id = $1", [id]);
    const people = tickets.map((t) => { const h = holders.find((x) => x.id === t.id); return { name: (h?.holder_name ?? t.holderName) as string, phone: (h?.holder_phone ?? "") as string, token: t.token }; });
    return ok({ ...r, emailSent: mails.length > 0 && mails.every((m) => m.status === "sent"), emailsTotal: mails.length, emailsSent: mails.filter((m) => m.status === "sent").length, tokens: tickets.map((t) => t.token), people });
  });
}
