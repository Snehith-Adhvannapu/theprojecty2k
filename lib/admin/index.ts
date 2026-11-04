import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/normalize";
import { query, transaction } from "@/lib/db";
import { audit, hashPassword } from "@/lib/auth";
import { issueTicket, tokenForTicket } from "@/lib/tickets";
import { clearSyncThrottle, syncOrderPayment } from "@/lib/payments";
import { fakePaymentsEnabled } from "@/lib/payments/provider";

/**
 * Money definitions (all integer paise):
 *  gross   = captured payments + refunded payments (everything the gateway took)
 *  refunds = refunded payments
 *  fees    = gateway fees reported by the gateway where available (null counts as 0, so it can understate)
 *  net     = gross - refunds - fees
 */
export async function summary() {
  const [c] = await query(`
    SELECT
      COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid'), 0)::int AS sold,
      COALESCE((SELECT SUM(total_qty) FROM pass_types WHERE active), 0)::int AS capacity,
      COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('pending','awaiting_review') AND o.expires_at > now()), 0)::int AS held,
      (SELECT count(*) FROM tickets WHERE source = 'comp' AND status <> 'revoked')::int AS comps,
      (SELECT count(*) FROM tickets WHERE status = 'used')::int AS checked_in_tickets,
      COALESCE((SELECT SUM(admits) FROM tickets WHERE status = 'used'), 0)::int AS checked_in_people,
      COALESCE((SELECT SUM(admits) FROM tickets WHERE status IN ('valid','used')), 0)::int AS people_expected,
      COALESCE((SELECT SUM(amount_paise) FROM payments WHERE status IN ('captured','refunded')), 0)::int AS gross,
      COALESCE((SELECT SUM(amount_paise) FROM refunds), 0)::int AS refunds,
      COALESCE((SELECT SUM(amount_paise) FROM orders WHERE status = 'needs_refund'), 0)::int AS refunds_owed,
      COALESCE((SELECT SUM(fee_paise) FROM payments WHERE status IN ('captured','refunded')), 0)::int AS fees,
      COALESCE((SELECT SUM(fee_paise) FROM orders WHERE status = 'paid'), 0)::int AS booking_fees,
      COALESCE((SELECT SUM(amount_paise) FROM orders WHERE status = 'paid' AND paid_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'), 0)::int AS today_paise,
      COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid' AND o.paid_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'), 0)::int AS today_passes
  `);
  const needsRefund = await query(
    `SELECT id, buyer_name, buyer_phone, amount_paise, created_at FROM orders WHERE status = 'needs_refund' ORDER BY created_at`,
  );
  const [h] = await query(`
    SELECT
      (SELECT count(*) FROM orders WHERE status = 'pending' AND expires_at > now())::int AS pending_orders,
      (SELECT count(*) FROM orders WHERE status = 'awaiting_review')::int AS awaiting_review,
      (SELECT count(*) FROM email_outbox WHERE status = 'failed')::int AS failed_emails,
      (SELECT count(*) FROM email_outbox WHERE status = 'pending')::int AS pending_emails,
      (SELECT max(received_at) FROM webhook_events) AS last_webhook`);
  return {
    counts: { ...c, left: Math.max(0, c.capacity - c.sold - c.held) },
    money: { gross: c.gross, refunds: c.refunds, owed: c.refunds_owed, fees: c.fees, net: c.gross - c.fees, inBank: c.gross + c.refunds_owed, bookingFees: c.booking_fees, todayPaise: c.today_paise, todayPasses: c.today_passes },
    needsRefund,
    health: { ...h, db: true, lastWebhook: h.last_webhook ? new Date(h.last_webhook).toISOString() : null, fakePayments: fakePaymentsEnabled() },
  };
}

export interface GuestRow {
  id: string; shortCode: string; name: string; phone: string; email: string | null; instagram: string | null;
  passName: string; admits: number; status: string; source: string; orderId: string | null;
  usedAt: string | null; usedBy: string | null; createdAt: string;
}

const GUEST_SQL = `
  SELECT t.id, t.short_code, t.holder_name, t.holder_phone, t.holder_email, t.holder_instagram, t.admits, t.status,
         t.source, t.order_id, t.used_at, t.created_at, p.name AS pass_name, s.name AS used_by
    FROM tickets t JOIN pass_types p ON p.id = t.pass_type_id LEFT JOIN staff_users s ON s.id = t.used_by`;

const toGuest = (r: Record<string, never>): GuestRow => ({
  id: r["id"], shortCode: r["short_code"], name: r["holder_name"], phone: r["holder_phone"],
  email: r["holder_email"], instagram: r["holder_instagram"], passName: r["pass_name"], admits: r["admits"],
  status: r["status"], source: r["source"], orderId: r["order_id"],
  usedAt: r["used_at"] ? new Date(r["used_at"]).toISOString() : null, usedBy: r["used_by"],
  createdAt: new Date(r["created_at"]).toISOString(),
});

export async function searchGuests(q: string, limit = 50): Promise<GuestRow[]> {
  const term = q.trim().replace(/[%_\\]/g, "");
  const rows = term
    ? await query(
        `${GUEST_SQL} WHERE t.holder_name ILIKE $1 OR t.holder_phone ILIKE $1 OR t.short_code ILIKE $1
            OR t.holder_instagram ILIKE $1 OR t.id::text = $2 OR t.holder_email ILIKE $1
          ORDER BY t.holder_name LIMIT $3`,
        [`%${term}%`, term, limit],
      )
    : await query(`${GUEST_SQL} ORDER BY t.created_at DESC LIMIT $1`, [limit]);
  return rows.map((r) => toGuest(r as never));
}

export async function allGuests(): Promise<GuestRow[]> {
  return (await query(`${GUEST_SQL} ORDER BY t.holder_name`)).map((r) => toGuest(r as never));
}

export async function checkinHistory(limit = 200) {
  return (
    await query(
      `SELECT c.server_time, c.outcome, c.method, c.mode, t.short_code, t.holder_name, s.name AS staff_name
         FROM checkins c LEFT JOIN tickets t ON t.id = c.ticket_id JOIN staff_users s ON s.id = c.staff_id
        ORDER BY c.server_time DESC LIMIT $1`,
      [limit],
    )
  ).map((r) => ({
    at: new Date(r.server_time).toISOString(), outcome: r.outcome as string, method: r.method as string,
    mode: r.mode as string, shortCode: (r.short_code ?? null) as string | null, name: (r.holder_name ?? null) as string | null,
    staff: r.staff_name as string,
  }));
}

export async function listPasses() {
  return (
    await query(
      `SELECT p.*, COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                              WHERE oi.pass_type_id = p.id AND o.status = 'paid'), 0)::int AS sold,
            COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.pass_type_id = p.id AND o.status IN ('pending','awaiting_review') AND o.expires_at > now()), 0)::int AS held
         FROM pass_types p ORDER BY p.sort, p.price_paise`,
    )
  ).map((p) => ({
    id: p.id as string, name: p.name as string, description: p.description as string,
    pricePaise: p.price_paise as number, feePaise: p.fee_paise as number, totalQty: p.total_qty as number,
    admits: p.admits as number, active: p.active as boolean, sort: p.sort as number, sold: p.sold as number, held: p.held as number,
    salesStart: p.sales_start ? new Date(p.sales_start).toISOString() : null,
    salesEnd: p.sales_end ? new Date(p.sales_end).toISOString() : null,
  }));
}

export interface PassInput {
  id?: string; name: string; description: string; pricePaise: number; feePaise: number;
  totalQty: number; admits: number; active: boolean; sort: number;
  salesStart: string | null; salesEnd: string | null;
}

export async function upsertPass(actorId: string, p: PassInput) {
  if (p.id) {
    const [sold] = await query(
      "SELECT COALESCE(SUM(oi.qty),0)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.pass_type_id = $1 AND o.status = 'paid'",
      [p.id],
    );
    if (p.totalQty < sold.n) throw new AppError("BELOW_SOLD", `${sold.n} already sold: total can't go lower.`, 409);
    await query(
      `UPDATE pass_types SET name=$2, description=$3, price_paise=$4, fee_paise=$5, total_qty=$6, admits=$7, active=$8, sort=$9,
                sales_start=$10, sales_end=$11 WHERE id=$1`,
      [p.id, p.name, p.description, p.pricePaise, p.feePaise, p.totalQty, p.admits, p.active, p.sort, p.salesStart, p.salesEnd],
    );
    await audit(actorId, "pass_updated", p.id, { price: p.pricePaise, total: p.totalQty, active: p.active });
    try { revalidatePath("/"); } catch { /* not in a request context (tests) */ } // keeps the Event price markup current
    return p.id;
  }
  const [ev] = await query("SELECT id FROM events ORDER BY created_at LIMIT 1");
  const [row] = await query(
    `INSERT INTO pass_types (event_id, name, description, price_paise, fee_paise, total_qty, admits, active, sort, sales_start, sales_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [ev.id, p.name, p.description, p.pricePaise, p.feePaise, p.totalQty, p.admits, p.active, p.sort, p.salesStart, p.salesEnd],
  );
  await audit(actorId, "pass_created", row.id, { name: p.name });
  try { revalidatePath("/"); } catch { /* not in a request context (tests) */ }
  return row.id as string;
}

export async function listVolunteers() {
  return (await query("SELECT id, email, name, role, active, created_at FROM staff_users WHERE role <> 'superadmin' ORDER BY role, name")).map((u) => ({
    id: u.id as string, email: u.email as string, name: u.name as string, role: u.role as string, active: u.active as boolean,
  }));
}

export async function createVolunteer(actorId: string, v: { email: string; name: string; password: string; role: "volunteer" | "admin" }) {
  const email = v.email.trim().toLowerCase();
  const dup = await query("SELECT 1 FROM staff_users WHERE email = $1", [email]);
  if (dup.length) throw new AppError("EXISTS", "That email already has an account.", 409);
  const [row] = await query(
    "INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id",
    [email, v.name.trim(), v.role, hashPassword(v.password)],
  );
  await audit(actorId, "staff_created", row.id, { role: v.role });
  return row.id as string;
}

export async function setStaffActive(actorId: string, staffId: string, active: boolean) {
  if (staffId === actorId) throw new AppError("SELF", "You can't change your own access.", 400);
  const [u] = await query("SELECT role, active FROM staff_users WHERE id = $1", [staffId]);
  if (!u || u.role === "superadmin") throw new AppError("NOT_FOUND", "Account not found.", 404);
  if (!active && u.role === "admin" && u.active) {
    const [{ n }] = await query("SELECT count(*)::int AS n FROM staff_users WHERE role = 'admin' AND active AND id <> $1", [staffId]);
    if (n < 1) throw new AppError("LAST_ADMIN", "There must be at least one active admin.", 400);
  }
  await query("UPDATE staff_users SET active = $2 WHERE id = $1", [staffId, active]);
  if (!active) await query("DELETE FROM sessions WHERE staff_id = $1", [staffId]);
  await audit(actorId, active ? "staff_restored" : "staff_revoked", staffId);
}

/** Admin sets a new password (forgotten password, handover). Signs the person out everywhere and clears any lockout. */
export async function resetStaffPassword(actorId: string, staffId: string, password: string) {
  const [u] = await query("SELECT 1 FROM staff_users WHERE id = $1 AND role <> 'superadmin'", [staffId]);
  if (!u) throw new AppError("NOT_FOUND", "Account not found.", 404);
  await query("UPDATE staff_users SET password_hash = $2, failed_count = 0, locked_until = NULL WHERE id = $1", [staffId, hashPassword(password)]);
  await query("DELETE FROM sessions WHERE staff_id = $1", [staffId]);
  await audit(actorId, "staff_password_reset", staffId);
}

export async function compTicket(
  actorId: string,
  c: { name: string; phone: string; email: string | null; instagram: string | null; passTypeId: string; reason: string },
) {
  const [pass] = await query("SELECT id, admits FROM pass_types WHERE id = $1", [c.passTypeId]);
  if (!pass) throw new AppError("NOT_FOUND", "Pass not found.", 404);
  const t = await transaction((q) =>
    issueTicket(q, {
      orderId: null, orderItemId: null, passTypeId: pass.id, admits: pass.admits, holderName: c.name,
      holderPhone: c.phone, holderEmail: c.email, holderInstagram: c.instagram, source: "comp", compReason: c.reason,
    }),
  );
  await audit(actorId, "ticket_comped", t.id, { reason: c.reason });
  return { id: t.id, shortCode: t.shortCode, token: tokenForTicket(t.id) };
}

/** Paid-but-no-ticket hunting. Asks the gateway about every pending order that has a payment attempt. */
export async function reconcile(actorId: string) {
  const pending = await query(
    `SELECT DISTINCT o.id FROM orders o JOIN payments p ON p.order_id = o.id
      WHERE o.status = 'pending' AND p.status = 'created' AND p.provider = 'razorpay'`,
  );
  let recovered = 0;
  const errors: string[] = [];
  for (const o of pending) {
    try {
      clearSyncThrottle(o.id);
      const r = await syncOrderPayment(o.id);
      if (r && "orderId" in r) recovered++;
    } catch {
      errors.push(o.id);
    }
  }
  const noTicket = await query(
    `SELECT o.id, o.buyer_name, o.amount_paise FROM orders o
      WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id)`,
  );
  const needsRefund = await query("SELECT id, buyer_name, amount_paise FROM orders WHERE status = 'needs_refund'");
  const doubles = await query(
    `SELECT order_id, count(*)::int AS n FROM payments WHERE status = 'captured' GROUP BY order_id HAVING count(*) > 1`,
  );
  await audit(actorId, "reconcile_run", null, { checked: pending.length, recovered });
  return { checked: pending.length, recovered, errors: errors.length, paidWithoutTickets: noTicket, needsRefund, doubleCaptures: doubles };
}

export async function resendTicketEmail(actorId: string, orderId: string) {
  const [o] = await query("SELECT buyer_email, status FROM orders WHERE id = $1", [orderId]);
  if (!o || o.status !== "paid") throw new AppError("NOT_PAID", "That order is not paid.", 409);
  await query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'ticket')", [orderId, o.buyer_email]);
  await audit(actorId, "email_resent", orderId);
}

/** Fix a typo on a ticket: the name shown at the door, contact details, and (for bought tickets) where the ticket email goes. */
export async function updateGuest(
  actorId: string, ticketId: string,
  v: { name: string; phone: string; email: string | null; instagram: string | null },
) {
  const [t] = await query("SELECT id, order_id FROM tickets WHERE id = $1", [ticketId]);
  if (!t) throw new AppError("NOT_FOUND", "Ticket not found.", 404);
  const email = v.email ? normalizeEmail(v.email) : null;
  await transaction(async (q) => {
    await q.query("UPDATE tickets SET holder_name = $2, holder_phone = $3, holder_email = $4, holder_instagram = $5 WHERE id = $1", [ticketId, v.name, v.phone, email, v.instagram]);
    // The buyer's email decides where the ticket is sent, so keep the order in step with it.
    if (t.order_id && email) await q.query("UPDATE orders SET buyer_email = $2 WHERE id = $1", [t.order_id, email]);
  });
  await audit(actorId, "guest_edited", ticketId, { fields: "name, phone, email, instagram" }); // never the values: they include phone and email
}

/** Undo a mistaken scan so the ticket can be scanned again. Only a used ticket; the scan history stays as it is. */
export async function undoCheckin(actorId: string, ticketId: string) {
  const r = await query("UPDATE tickets SET status = 'valid', used_at = NULL, used_by = NULL WHERE id = $1 AND status = 'used' RETURNING id", [ticketId]);
  if (!r.length) throw new AppError("NOT_USED", "That ticket isn't checked in.", 409);
  await audit(actorId, "checkin_undone", ticketId);
}

/** Emails that gave up after several failed tries go back in the queue and are sent now. */
export async function retryFailedEmails(actorId: string) {
  const r = await query("UPDATE email_outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'failed' RETURNING id");
  await audit(actorId, "emails_retried", null, { count: r.length });
  return r.length;
}
