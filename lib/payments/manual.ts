// Manual UPI verification. The buyer pays in their own UPI app, then submits the UTR and a
// screenshot. A ticket exists ONLY after an admin approves the order. Approval is the
// confirmation step, so it re-checks stock under the pass-type lock and is idempotent.
import { z } from "zod";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { query, transaction, type Q } from "@/lib/db";
import { availability } from "@/lib/inventory";
import { issueTicketsForOrder, ticketsForOrder } from "@/lib/tickets";
import { storeProof } from "@/lib/proof";
import { eventConfig } from "@/config/event";

export const utrSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, "Enter the 12-digit UTR / UPI reference number from your payment");

const audit = (q: Q, action: string, target: string, meta: Record<string, unknown> = {}) =>
  q.query("INSERT INTO audit_logs (action, target, meta) VALUES ($1,$2,$3)", [action, target, JSON.stringify(meta)]);

async function lockOrderStock(q: Q, orderId: string) {
  const items = await q.query("SELECT pass_type_id, qty FROM order_items WHERE order_id = $1 ORDER BY pass_type_id", [orderId]);
  await q.query("SELECT id FROM pass_types WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [items.map((i) => i.pass_type_id)]);
  for (const it of items) if ((await availability(q, it.pass_type_id, orderId)) < it.qty) return false;
  return true;
}

export type SubmitResult = { status: "awaiting_review" };

export async function submitProof(orderId: string, utrInput: string, image: Buffer): Promise<SubmitResult> {
  const utr = utrSchema.parse(utrInput);
  const [o] = await query("SELECT status FROM orders WHERE id = $1", [orderId]);
  if (!o) throw new AppError("NOT_FOUND", "Order not found.", 404);
  if (o.status === "awaiting_review") throw new AppError("ALREADY_SUBMITTED", "You already submitted this payment. We're verifying it.", 409);
  if (o.status === "paid") throw new AppError("ALREADY_PAID", "This order is already confirmed.", 409);
  if (o.status !== "pending") throw new AppError("ORDER_CLOSED", "This order is closed. Please start a new one.", 409);

  const proof = await storeProof(image);
  try {
    return await transaction(async (q): Promise<SubmitResult> => {
      const [order] = await q.query("SELECT id, status, expires_at <= now() AS expired FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
      if (order.status !== "pending") throw new AppError("ALREADY_SUBMITTED", "This order was already submitted.", 409);
      // Hold ended before they paid: only continue if the stock is still free.
      if (order.expired && !(await lockOrderStock(q, orderId))) {
        throw new AppError("SOLD_OUT", "Your hold expired and these passes have since sold out. If you already paid, WhatsApp us with your UTR and we'll refund you.", 410);
      }
      await q.query(
        `UPDATE orders SET status = 'awaiting_review', utr = $2, proof_url = $3, proof_data = $4, proof_mime = $5,
                submitted_at = now(), review_note = NULL,
                expires_at = now() + make_interval(hours => $6)
          WHERE id = $1`,
        [orderId, utr, proof.url, proof.data, proof.mime, eventConfig.payment.reviewHoldHours],
      );
      await audit(q, "proof_submitted", orderId);
      const [b] = await q.query("SELECT buyer_email FROM orders WHERE id = $1", [orderId]);
      await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'received')", [orderId, b.buyer_email]);
      return { status: "awaiting_review" };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("UTR_USED", "That UTR was already used for another order. Check the number, or WhatsApp us.", 409);
    throw e;
  }
}

export type ReviewResult = { result: "approved" | "already_approved" | "needs_refund" | "rejected" | "resubmit" };

export async function approveOrder(orderId: string, staffId: string): Promise<ReviewResult> {
  return transaction(async (q): Promise<ReviewResult> => {
    const [o] = await q.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!o) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (o.status === "paid") return { result: "already_approved" };
    // A rejection can be reversed (the buyer confirmed on a call). Needs the UTR that was on file.
    const reversal = o.status === "rejected" && !!o.utr;
    if (o.status !== "awaiting_review" && !reversal) throw new AppError("NOT_AWAITING", "This order isn't waiting for review.", 409);

    if (!(await lockOrderStock(q, orderId))) {
      await q.query("UPDATE orders SET status = 'needs_refund', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [orderId, staffId]);
      await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'needs_refund')", [orderId, o.buyer_email]);
      await audit(q, "approve_no_stock_needs_refund", orderId, { staffId });
      return { result: "needs_refund" };
    }
    try {
      await q.query(
        `INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, status, amount_paise, fee_paise, captured_at)
         VALUES ($1::uuid,'upi_manual',$2::text,$3,'captured',$4,0,now())`,
        [orderId, orderId, o.utr, o.amount_paise],
      );
      await q.query("UPDATE orders SET status = 'paid', paid_at = now(), review_note = NULL, reviewed_by = $2, reviewed_at = now() WHERE id = $1", [orderId, staffId]);
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("UTR_IN_USE", "Another order already uses this UTR, so this one can't be approved.", 409);
      throw e;
    }
    await issueTicketsForOrder(q, orderId);
    await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'ticket')", [orderId, o.buyer_email]);
    await audit(q, reversal ? "rejection_reversed_approved" : "payment_approved", orderId, { staffId, amountPaise: o.amount_paise });
    return { result: "approved" };
  });
}

/** resubmit = back to pending so the buyer can fix a blurry screenshot or typo'd UTR; otherwise final. */
/** refund = the money did arrive but the person is being turned down: the order goes to the refund list. */
export async function rejectOrder(orderId: string, staffId: string, reason: string, resubmit: boolean, refund = false): Promise<ReviewResult> {
  const note = z.string().trim().min(3, "Give the buyer a short reason").max(300).parse(reason);
  return transaction(async (q): Promise<ReviewResult> => {
    const [o] = await q.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!o) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (o.status !== "awaiting_review") throw new AppError("NOT_AWAITING", "This order isn't waiting for review.", 409);
    if (resubmit) {
      await q.query(
        `UPDATE orders SET status = 'pending', utr = NULL, proof_url = NULL, proof_data = NULL, proof_mime = NULL,
                review_note = $2, reviewed_by = $3, reviewed_at = now(), expires_at = now() + interval '2 hours'
          WHERE id = $1`,
        [orderId, note, staffId],
      );
    } else {
      await q.query("UPDATE orders SET status = $4, review_note = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1", [orderId, note, staffId, refund ? "needs_refund" : "rejected"]);
    }
    await q.query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'rejected')", [orderId, o.buyer_email]);
    await audit(q, resubmit ? "payment_resubmit_requested" : refund ? "rejected_refund_owed" : "payment_rejected", orderId, { staffId });
    return { result: resubmit ? "resubmit" : refund ? "needs_refund" : "rejected" };
  });
}

export interface ReviewRow {
  id: string; status: string; buyerName: string; buyerPhone: string; buyerEmail: string;
  items: string; amountPaise: number; utr: string | null; submittedAt: string | null;
  reviewNote: string | null; hasProof: boolean; ticketToken: string | null;
  /** a final rejection that can still be turned into an approval */
  canReverse: boolean;
}

export async function reviewQueue(): Promise<{ pending: ReviewRow[]; reviewed: ReviewRow[] }> {
  const rows = await query(
    `SELECT o.id, o.status, o.buyer_name, o.buyer_phone, o.buyer_email, o.amount_paise, o.utr, o.submitted_at, o.review_note,
            (o.proof_url IS NOT NULL OR o.proof_data IS NOT NULL) AS has_proof,
            (SELECT string_agg(p.name || ' x' || oi.qty, ', ') FROM order_items oi JOIN pass_types p ON p.id = oi.pass_type_id WHERE oi.order_id = o.id) AS items
       FROM orders o
      WHERE o.status = 'awaiting_review'
         OR (o.submitted_at IS NOT NULL AND o.status IN ('paid','rejected','needs_refund'))
         OR (o.status = 'pending' AND o.review_note IS NOT NULL AND o.expires_at > now())
      ORDER BY o.submitted_at ASC`,
  );
  const out: ReviewRow[] = [];
  for (const r of rows) {
    out.push({
      id: r.id, status: r.status, buyerName: r.buyer_name, buyerPhone: r.buyer_phone, buyerEmail: r.buyer_email,
      items: r.items ?? "", amountPaise: r.amount_paise, utr: r.utr, hasProof: r.has_proof,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null, reviewNote: r.review_note,
      canReverse: r.status === "rejected" && !!r.utr,
      ticketToken: r.status === "paid" ? ((await ticketsForOrder({ query }, r.id))[0]?.token ?? null) : null,
    });
  }
  return { pending: out.filter((r) => r.status === "awaiting_review"), reviewed: out.filter((r) => r.status !== "awaiting_review").reverse().slice(0, 40) };
}

export async function getProof(orderId: string) {
  const [r] = await query("SELECT proof_url, proof_data, proof_mime FROM orders WHERE id = $1", [orderId]);
  if (!r || (!r.proof_url && !r.proof_data)) throw new AppError("NOT_FOUND", "No proof on this order.", 404);
  return { url: r.proof_url as string | null, data: r.proof_data as Buffer | null, mime: (r.proof_mime as string) ?? "image/jpeg" };
}

/** A final rejection where the money had actually arrived: put it on the refund list. */
export async function markRefundOwed(orderId: string, staffId: string): Promise<void> {
  await transaction(async (q) => {
    const [o] = await q.query("SELECT status FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!o) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (o.status === "needs_refund") return; // idempotent
    if (o.status !== "rejected") throw new AppError("NOT_REJECTED", "Only rejected orders can be moved to the refund list.", 409);
    await q.query("UPDATE orders SET status = 'needs_refund', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [orderId, staffId]);
    await audit(q, "refund_marked_owed", orderId, { staffId });
  });
}

export const refundInput = z.object({
  method: z.enum(["upi", "whatsapp", "cash", "other"]),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Admin confirms the money went back (UPI app, agreed in a WhatsApp chat, cash...). Recorded once per order. */
export async function markRefunded(orderId: string, staffId: string, input: z.input<typeof refundInput> = { method: "upi" }): Promise<void> {
  const d = refundInput.parse(input);
  await transaction(async (q) => {
    const [o] = await q.query("SELECT status, amount_paise FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!o) throw new AppError("NOT_FOUND", "Order not found.", 404);
    if (o.status === "refunded") return; // idempotent
    if (o.status !== "needs_refund") throw new AppError("NOT_REFUNDABLE", "Only orders marked as needing a refund can be marked refunded.", 409);
    await q.query("UPDATE orders SET status = 'refunded', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [orderId, staffId]);
    await q.query(
      "INSERT INTO refunds (order_id, amount_paise, method, reference, note, refunded_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (order_id) DO NOTHING",
      [orderId, o.amount_paise, d.method, d.reference || null, d.note || null, staffId],
    );
    await q.query("INSERT INTO email_outbox (order_id, to_email, kind) SELECT id, buyer_email, 'refunded' FROM orders WHERE id = $1", [orderId]);
    await audit(q, "marked_refunded", orderId, { staffId, method: d.method, amountPaise: o.amount_paise });
  });
}

export interface RefundRow {
  orderId: string; name: string; phone: string; amountPaise: number; reason: string | null; at: string;
  method?: string; reference?: string | null; note?: string | null; by?: string | null;
}

/** Everything about refunds in one place: who is owed, who has been paid back, and the totals. */
export async function refundLedger() {
  const owedRows = await query(
    `SELECT id, buyer_name, buyer_phone, amount_paise, review_note, COALESCE(reviewed_at, created_at) AS at
       FROM orders WHERE status = 'needs_refund' ORDER BY COALESCE(reviewed_at, created_at)`);
  const doneRows = await query(
    `SELECT r.order_id, r.amount_paise, r.method, r.reference, r.note, r.refunded_at, o.buyer_name, o.buyer_phone, o.review_note, s.name AS by
       FROM refunds r JOIN orders o ON o.id = r.order_id LEFT JOIN staff_users s ON s.id = r.refunded_by
      ORDER BY r.refunded_at DESC LIMIT 200`);
  const owed: RefundRow[] = owedRows.map((r) => ({ orderId: r.id, name: r.buyer_name, phone: r.buyer_phone, amountPaise: r.amount_paise, reason: r.review_note, at: new Date(r.at).toISOString() }));
  const done: RefundRow[] = doneRows.map((r) => ({
    orderId: r.order_id, name: r.buyer_name, phone: r.buyer_phone, amountPaise: r.amount_paise, reason: r.review_note, at: new Date(r.refunded_at).toISOString(),
    method: r.method, reference: r.reference, note: r.note, by: r.by,
  }));
  const sum = (x: RefundRow[]) => x.reduce((a, r) => a + r.amountPaise, 0);
  return { owed, done, totals: { owedCount: owed.length, owedPaise: sum(owed), refundedCount: done.length, refundedPaise: sum(done) } };
}
