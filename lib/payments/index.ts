// Money path. A payment is confirmed ONLY by a signature-verified webhook or by a
// server-side fetch of the payment from the gateway. Browsers never confirm anything.
import { AppError } from "@/lib/errors";
import { query, transaction, type Q } from "@/lib/db";
import { availability } from "@/lib/inventory";
import { issueTicketsForOrder, ticketsForOrder, type TicketView } from "@/lib/tickets";
import { getProvider, type PaymentEvent } from "./provider";

export type ApplyResult =
  | { result: "duplicate" | "ignored" | "noop" }
  | { result: "confirmed" | "needs_refund" | "refunded" | "failed_recorded"; orderId: string };

const audit = (q: Q, action: string, target: string, meta: Record<string, unknown> = {}) =>
  q.query("INSERT INTO audit_logs (action, target, meta) VALUES ($1,$2,$3)", [action, target, JSON.stringify(meta)]);

export async function initiatePayment(orderId: string) {
  const [order] = await query("SELECT id, status, amount_paise, expires_at, expires_at <= now() AS expired FROM orders WHERE id = $1", [orderId]);
  if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);
  if (order.status === "paid") throw new AppError("ALREADY_PAID", "This order is already paid.", 409);
  if (order.status !== "pending") throw new AppError("ORDER_CLOSED", "This order can no longer be paid.", 409);
  if (order.expired) throw new AppError("ORDER_EXPIRED", "Your hold expired. Please start again.", 410);

  const provider = getProvider();
  const existing = await query(
    "SELECT provider_order_id FROM payments WHERE order_id = $1 AND status = 'created' AND provider = $2 ORDER BY created_at DESC LIMIT 1",
    [orderId, provider.name],
  );
  let providerOrderId: string = existing[0]?.provider_order_id;
  if (!providerOrderId) {
    ({ providerOrderId } = await provider.createOrder(order.amount_paise, orderId.replace(/-/g, "")));
    await query(
      "INSERT INTO payments (order_id, provider, provider_order_id, amount_paise) VALUES ($1,$2,$3,$4)",
      [orderId, provider.name, providerOrderId, order.amount_paise],
    );
  }
  return {
    provider: provider.name,
    providerOrderId,
    amountPaise: order.amount_paise as number,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || null,
  };
}

/** Idempotent. Safe to call any number of times, concurrently, for the same event. */
export async function applyPaymentEvent(ev: PaymentEvent): Promise<ApplyResult> {
  return transaction(async (q): Promise<ApplyResult> => {
    const fresh = await q.query(
      "INSERT INTO webhook_events (provider_event_id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1",
      [ev.eventId, ev.kind],
    );
    if (!fresh.length) return { result: "duplicate" };

    if (ev.kind === "failed") {
      const r = await q.query(
        "UPDATE payments SET status = 'failed' WHERE provider_order_id = $1 AND status = 'created' RETURNING order_id",
        [ev.providerOrderId],
      );
      return r.length ? { result: "failed_recorded", orderId: r[0].order_id } : { result: "ignored" };
    }

    if (ev.kind === "refunded") return applyRefund(q, ev);
    return applyCapture(q, ev);
  });
}

async function applyCapture(q: Q, ev: Extract<PaymentEvent, { kind: "captured" }>): Promise<ApplyResult> {
  const [pay] = await q.query("SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE", [ev.providerOrderId]);
  if (!pay) return { result: "ignored" };
  if (pay.status === "captured" || pay.status === "refunded") return { result: "noop" };

  const [order] = await q.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [pay.order_id]);
  const markCaptured = () =>
    q.query(
      "UPDATE payments SET status = 'captured', provider_payment_id = $2, fee_paise = $3, captured_at = now() WHERE id = $1",
      [pay.id, ev.providerPaymentId, ev.feePaise],
    );

  if (ev.amountPaise !== pay.amount_paise) {
    await markCaptured();
    await q.query("UPDATE orders SET status = 'needs_refund' WHERE id = $1 AND status <> 'paid'", [order.id]);
    await audit(q, "payment_amount_mismatch", order.id, { expected: pay.amount_paise, got: ev.amountPaise });
    return { result: "needs_refund", orderId: order.id };
  }
  if (order.status === "paid") {
    await markCaptured(); // a second capture on a paid order: keep the record, reconcile will show it
    await audit(q, "payment_on_paid_order", order.id, { paymentId: ev.providerPaymentId });
    return { result: "noop" };
  }

  const expired = new Date(order.expires_at).getTime() <= Date.now();
  if (order.status !== "pending" || expired) {
    // Late payment: try to take the stock again, atomically. Never drop a paid order.
    const items = await q.query("SELECT pass_type_id, qty FROM order_items WHERE order_id = $1 ORDER BY pass_type_id", [order.id]);
    await q.query("SELECT id FROM pass_types WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [items.map((i) => i.pass_type_id)]);
    let ok = true;
    for (const it of items) if ((await availability(q, it.pass_type_id, order.id)) < it.qty) ok = false;
    if (!ok) {
      await markCaptured();
      await q.query("UPDATE orders SET status = 'needs_refund' WHERE id = $1", [order.id]);
      await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'needs_refund')", [order.id, order.buyer_email]);
      await audit(q, "late_payment_needs_refund", order.id, { paymentId: ev.providerPaymentId });
      return { result: "needs_refund", orderId: order.id };
    }
  }

  await markCaptured();
  await q.query("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1", [order.id]);
  await issueTicketsForOrder(q, order.id);
  await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'ticket')", [order.id, order.buyer_email]);
  return { result: "confirmed", orderId: order.id };
}

async function applyRefund(q: Q, ev: Extract<PaymentEvent, { kind: "refunded" }>): Promise<ApplyResult> {
  const [pay] = await q.query("SELECT * FROM payments WHERE provider_payment_id = $1 FOR UPDATE", [ev.providerPaymentId]);
  if (!pay) return { result: "ignored" };
  if (ev.refundAmountPaise < pay.amount_paise) {
    await audit(q, "partial_refund_seen", pay.order_id, { amount: ev.refundAmountPaise });
    return { result: "noop" };
  }
  await q.query("UPDATE payments SET status = 'refunded' WHERE id = $1", [pay.id]);
  await q.query("UPDATE orders SET status = 'refunded' WHERE id = $1", [pay.order_id]);
  await q.query("UPDATE tickets SET status = 'revoked' WHERE order_id = $1 AND status = 'valid'", [pay.order_id]);
  await audit(q, "refund_revoked_tickets", pay.order_id, { paymentId: ev.providerPaymentId });
  return { result: "refunded", orderId: pay.order_id };
}

// ---- Backup path: ask the gateway ourselves ------------------------------------
const lastSync = new Map<string, number>();
export const clearSyncThrottle = (orderId: string) => void lastSync.delete(orderId);

export async function syncOrderPayment(orderId: string): Promise<ApplyResult | null> {
  const now = Date.now();
  if (now - (lastSync.get(orderId) ?? 0) < 10_000) return null;
  lastSync.set(orderId, now);
  const pays = await query(
    "SELECT provider_order_id FROM payments WHERE order_id = $1 AND status = 'created' AND provider = 'razorpay'",
    [orderId],
  );
  const provider = getProvider();
  for (const p of pays) {
    const cap = await provider.fetchCapturedPayment(p.provider_order_id);
    if (cap) {
      return applyPaymentEvent({
        kind: "captured", eventId: `fetch:${cap.paymentId}`, providerOrderId: p.provider_order_id,
        providerPaymentId: cap.paymentId, amountPaise: cap.amountPaise, feePaise: cap.feePaise,
      });
    }
  }
  return null;
}

// ---- Polling endpoint's brain ---------------------------------------------------
export interface OrderStatusView {
  status: "pending" | "awaiting_review" | "rejected" | "paid" | "expired" | "needs_refund" | "refunded";
  /** why a payment was sent back (pending again) or rejected */
  reviewNote: string | null;
  expiresAt: string;
  amountPaise: number;
  /** where the ticket will be emailed, masked: a***@gmail.com */
  emailMasked: string;
  tickets: TicketView[];
  /** pending for > 10s: the server is asking the gateway directly */
  checkingWithGateway: boolean;
}

const maskEmail = (e: string) => { const [u, d] = e.split("@"); return d ? `${u.slice(0, 1)}***@${d}` : ""; };

export async function getOrderStatus(orderId: string): Promise<OrderStatusView | null> {
  const load = async () =>
    (await query("SELECT id, status, amount_paise, expires_at, created_at, review_note, buyer_email, expires_at <= now() AS expired FROM orders WHERE id = $1", [orderId]))[0];
  let o = await load();
  if (!o) return null;
  let checking = false;
  if (o.status === "pending") {
    const [pay] = await query("SELECT created_at, provider FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1", [orderId]);
    if (pay && pay.provider === "razorpay" && Date.now() - new Date(pay.created_at).getTime() > 10_000) {
      checking = true;
      try {
        await syncOrderPayment(orderId);
      } catch {
        /* gateway hiccup: next poll tries again */
      }
      o = (await load()) ?? o;
    }
  }
  const status = o.status === "pending" && o.expired ? "expired" : (o.status as OrderStatusView["status"]);
  return {
    status,
    expiresAt: new Date(o.expires_at).toISOString(),
    amountPaise: o.amount_paise,
    reviewNote: o.review_note ?? null,
    emailMasked: maskEmail(String(o.buyer_email ?? "")),
    tickets: status === "paid" ? await ticketsForOrder({ query }, orderId) : [],
    checkingWithGateway: checking && status === "pending",
  };
}
