import { openDb, setDb, type Db } from "@/lib/db";
import { reserveOrder, type ReservedOrder } from "@/lib/inventory";
import { initiatePayment, applyPaymentEvent } from "@/lib/payments";

let db: Db;

/** One in-memory Postgres per test file; wiped and re-seeded before each test. */
export async function setupDb() {
  db ??= await openDb("memory:");
  setDb(db);
  await db.query(
    `TRUNCATE audit_logs, email_outbox, checkins, tickets, webhook_events, payments, order_items,
              orders, sessions, staff_users, pass_types, events RESTART IDENTITY CASCADE`,
  );
  const [event] = await db.query(
    "INSERT INTO events (name, starts_at, max_per_order) VALUES ('Test', now() + interval '10 days', 4) RETURNING id",
  );
  const [staff] = await db.query(
    "INSERT INTO staff_users (email, name, role, password_hash) VALUES ('v@test','Vol','volunteer','x') RETURNING id",
  );
  return { db, eventId: event.id as string, staffId: staff.id as string };
}

export async function makePass(eventId: string, totalQty: number, over: Record<string, unknown> = {}) {
  const [p] = await (await import("@/lib/db")).query(
    `INSERT INTO pass_types (event_id, name, price_paise, total_qty, admits)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [eventId, over.name ?? "General", over.price ?? 10000, totalQty, over.admits ?? 1],
  );
  return p.id as string;
}

let n = 0;
export const buyer = (phone = `+91900000${String(1000 + n++)}`) => ({
  name: "Test Buyer",
  phone,
  email: "buyer@test.dev",
  instagram: null,
});

export async function order(passTypeId: string, qty = 1, phone?: string): Promise<ReservedOrder> {
  return reserveOrder({
    items: [{ passTypeId, qty }],
    buyer: buyer(phone),
    idempotencyKey: crypto.randomUUID(),
  });
}

/** Reserve + initiate + capture, the way a successful webhook would. */
export async function paidOrder(passTypeId: string, qty = 1) {
  const o = await order(passTypeId, qty);
  const init = await initiatePayment(o.id);
  const res = await applyPaymentEvent({
    kind: "captured",
    eventId: `evt_${crypto.randomUUID()}`,
    providerOrderId: init.providerOrderId,
    providerPaymentId: `pay_${crypto.randomUUID()}`,
    amountPaise: init.amountPaise,
    feePaise: null,
  });
  return { order: o, init, res };
}
