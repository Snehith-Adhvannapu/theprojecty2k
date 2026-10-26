import { fail, handle, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { flushOutbox } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { hashToken } from "@/lib/tickets";

// "Email me a copy": goes only to the address already on the order, never to a caller-supplied one.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const hash = hashToken(token);
    const [t] = await query(
      "SELECT t.order_id, o.buyer_email FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.token_hash = $1 AND o.status = 'paid'",
      [hash],
    );
    if (!t || !rateLimit(`ticket-email:${hash}`, 3, 3_600_000)) {
      return t ? fail("RATE_LIMITED", "Already sent a few times. Check your inbox and spam folder.", 429) : fail("NOT_FOUND", "Ticket not found.", 404);
    }
    await query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'ticket')", [t.order_id, t.buyer_email]);
    await flushOutbox(t.order_id);
    return ok({});
  });
}
