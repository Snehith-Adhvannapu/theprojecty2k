import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { reserveOrder } from "@/lib/inventory";
import { applyPaymentEvent, getOrderStatus, initiatePayment } from "@/lib/payments";
import { checkIn } from "@/lib/checkin";
import { tokenForTicket, ticketsForOrder } from "@/lib/tickets";
import { buyer, makePass, order, paidOrder, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => {
  ctx = await setupDb();
});

describe("inventory", () => {
  it("20 parallel reservations on 1 remaining pass: exactly one wins", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => order(pass, 1, `+9190000${String(10000 + i)}`)),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    expect(rejected.every((r) => r.reason.code === "SOLD_OUT")).toBe(true);
  });

  it("same idempotency key returns the same order, not a second hold", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const input = { items: [{ passTypeId: pass, qty: 2 }], buyer: buyer(), idempotencyKey: "key-1" };
    const [a, b] = await Promise.all([reserveOrder(input), reserveOrder(input)]);
    expect(a.id).toBe(b.id);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM orders");
    expect(n).toBe(1);
  });

  it("an expired hold frees stock without any sweeper", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const o = await order(pass, 1);
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [o.id]);
    await expect(order(pass, 1)).resolves.toBeTruthy();
  });

  it("caps pending orders per phone and passes per order", async () => {
    const pass = await makePass(ctx.eventId, 50);
    await order(pass, 1, "+919876500001");
    await order(pass, 1, "+919876500001");
    await expect(order(pass, 1, "+919876500001")).rejects.toMatchObject({ code: "TOO_MANY_PENDING" });
    await expect(order(pass, 5)).rejects.toMatchObject({ code: "TOO_MANY" });
  });
});

describe("payments", () => {
  it("same webhook delivered 5 times (concurrently): one payment, one set of tickets", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 2);
    const init = await initiatePayment(o.id);
    const ev = {
      kind: "captured" as const, eventId: "evt_same", providerOrderId: init.providerOrderId,
      providerPaymentId: "pay_same", amountPaise: init.amountPaise, feePaise: null,
    };
    const res = await Promise.all(Array.from({ length: 5 }, () => applyPaymentEvent(ev)));
    expect(res.filter((r) => r.result === "confirmed")).toHaveLength(1);
    expect(res.filter((r) => r.result === "duplicate")).toHaveLength(4);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(2);
    const [{ p }] = await query("SELECT count(*)::int AS p FROM payments WHERE status = 'captured'");
    expect(p).toBe(1);
    const [{ e }] = await query("SELECT count(*)::int AS e FROM email_outbox WHERE kind = 'ticket'");
    expect(e).toBe(1);
  });

  it("webhook + server-side fetch for the same payment (different event ids): still one set", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 1);
    const init = await initiatePayment(o.id);
    const base = { kind: "captured" as const, providerOrderId: init.providerOrderId, providerPaymentId: "pay_x", amountPaise: init.amountPaise, feePaise: null };
    await Promise.all([applyPaymentEvent({ ...base, eventId: "evt_1" }), applyPaymentEvent({ ...base, eventId: "fetch:pay_x" })]);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(1);
  });

  it("late payment after expiry re-reserves when stock remains", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const o = await order(pass, 1);
    const init = await initiatePayment(o.id);
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [o.id]);
    const r = await applyPaymentEvent({
      kind: "captured", eventId: "evt_late", providerOrderId: init.providerOrderId,
      providerPaymentId: "pay_late", amountPaise: init.amountPaise, feePaise: null,
    });
    expect(r.result).toBe("confirmed");
  });

  it("late payment after expiry with stock gone: needs_refund, never lost", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const o = await order(pass, 1);
    const init = await initiatePayment(o.id);
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [o.id]);
    await paidOrder(pass, 1); // someone else takes the last pass
    const r = await applyPaymentEvent({
      kind: "captured", eventId: "evt_late2", providerOrderId: init.providerOrderId,
      providerPaymentId: "pay_late2", amountPaise: init.amountPaise, feePaise: null,
    });
    expect(r.result).toBe("needs_refund");
    const [row] = await query("SELECT status FROM orders WHERE id = $1", [o.id]);
    expect(row.status).toBe("needs_refund");
    const [pay] = await query("SELECT status FROM payments WHERE provider_payment_id = 'pay_late2'");
    expect(pay.status).toBe("captured"); // money is recorded
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets WHERE order_id = $1", [o.id]);
    expect(n).toBe(0);
  });

  it("amount mismatch never confirms", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const o = await order(pass, 1);
    const init = await initiatePayment(o.id);
    const r = await applyPaymentEvent({
      kind: "captured", eventId: "evt_bad", providerOrderId: init.providerOrderId,
      providerPaymentId: "pay_bad", amountPaise: 1, feePaise: null,
    });
    expect(r.result).toBe("needs_refund");
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(0);
  });

  it("order status: pending until a verified capture, then paid with tickets", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const o = await order(pass, 1);
    await initiatePayment(o.id);
    expect((await getOrderStatus(o.id))?.status).toBe("pending");
    const { order: o2 } = await paidOrder(pass, 1);
    const s = await getOrderStatus(o2.id);
    expect(s?.status).toBe("paid");
    expect(s?.tickets).toHaveLength(1);
  });

  it("refund webhook revokes tickets and the scanner rejects them", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const { order: o, init } = await paidOrder(pass, 1);
    const [pay] = await query("SELECT provider_payment_id FROM payments WHERE order_id = $1", [o.id]);
    const r = await applyPaymentEvent({
      kind: "refunded", eventId: "evt_ref", providerPaymentId: pay.provider_payment_id, refundAmountPaise: init.amountPaise,
    });
    expect(r.result).toBe("refunded");
    const [t] = await ticketsForOrder({ query }, o.id);
    const scan = await checkIn({ token: tokenForTicket(t.id), staffId: ctx.staffId, method: "qr" });
    expect(scan.outcome).toBe("revoked");
  });
});

describe("check-in", () => {
  it("2 parallel scans of one token: exactly one admitted", async () => {
    const pass = await makePass(ctx.eventId, 2, { admits: 2 });
    const { order: o } = await paidOrder(pass, 1);
    const [t] = await ticketsForOrder({ query }, o.id);
    const token = tokenForTicket(t.id);
    const res = await Promise.all([
      checkIn({ token, staffId: ctx.staffId, method: "qr" }),
      checkIn({ token, staffId: ctx.staffId, method: "qr" }),
    ]);
    expect(res.filter((r) => r.outcome === "admitted")).toHaveLength(1);
    expect(res.filter((r) => r.outcome === "duplicate")).toHaveLength(1);
    expect(res.find((r) => r.outcome === "admitted")?.ticket?.admits).toBe(2);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM checkins");
    expect(n).toBe(2);
  });

  it("a retried scan (same client event id) replays the answer instead of showing 'already used'", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const { order: o } = await paidOrder(pass, 1);
    const [t] = await ticketsForOrder({ query }, o.id);
    const input = { token: tokenForTicket(t.id), staffId: ctx.staffId, method: "qr" as const, clientEventId: crypto.randomUUID() };
    expect((await checkIn(input)).outcome).toBe("admitted");
    expect((await checkIn(input)).outcome).toBe("admitted");
  });

  it("manual admit by short code uses the same atomic path; typo rejected without DB", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const { order: o } = await paidOrder(pass, 1);
    const [t] = await ticketsForOrder({ query }, o.id);
    expect((await checkIn({ shortCode: t.shortCode.toLowerCase(), staffId: ctx.staffId, method: "manual" })).outcome).toBe("admitted");
    expect((await checkIn({ shortCode: t.shortCode, staffId: ctx.staffId, method: "manual" })).outcome).toBe("duplicate");
    const typo = t.shortCode.slice(0, -1) + (t.shortCode.endsWith("2") ? "3" : "2");
    const bad = await checkIn({ shortCode: typo, staffId: ctx.staffId, method: "manual" });
    expect(bad).toMatchObject({ outcome: "invalid", reason: "bad_code" });
  });

  it("unknown token is invalid", async () => {
    const r = await checkIn({ token: "nope", staffId: ctx.staffId, method: "qr" });
    expect(r).toMatchObject({ outcome: "invalid", reason: "not_found" });
  });

  it("only the token hash is stored", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const { order: o } = await paidOrder(pass, 1);
    const [t] = await ticketsForOrder({ query }, o.id);
    const [row] = await query("SELECT token_hash FROM tickets WHERE id = $1", [t.id]);
    expect(row.token_hash).not.toBe(t.token);
    expect(row.token_hash).toHaveLength(64);
  });
});
