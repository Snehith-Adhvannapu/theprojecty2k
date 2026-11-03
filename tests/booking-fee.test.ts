import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { eventConfig } from "@/config/event";
import { reserveOrder } from "@/lib/inventory";
import { getOrderStatus } from "@/lib/payments";
import { buyer, makePass, order, setupDb } from "./helpers";

const FEE = eventConfig.bookingFeePaise;
let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

describe("booking fee", () => {
  it("is Rs 30 per pass", () => {
    expect(FEE).toBe(3000);
  });

  it("one ticket: price + fee", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 149900 });
    const o = await order(pass, 1);
    expect(o.amountPaise).toBe(149900 + FEE);
  });

  it("three passes in one order: fee charged per pass", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 10000 });
    const o = await order(pass, 3);
    expect(o.amountPaise).toBe(3 * 10000 + 3 * FEE);
    const [row] = await query("SELECT amount_paise, fee_paise FROM orders WHERE id = $1", [o.id]);
    expect(row.amount_paise).toBe(3 * 10000 + 3 * FEE);
    expect(row.fee_paise).toBe(3 * FEE);
  });

  it("two different passes in one order: fee on all three", async () => {
    const a = await makePass(ctx.eventId, 10, { price: 10000, name: "A" });
    const b = await makePass(ctx.eventId, 10, { price: 20000, name: "B" });
    const o = await reserveOrder({ items: [{ passTypeId: a, qty: 1 }, { passTypeId: b, qty: 2 }], buyer: buyer(), idempotencyKey: "two-passes" });
    expect(o.amountPaise).toBe(10000 + 2 * 20000 + 3 * FEE);
  });

  it("adds to a per-pass fee instead of replacing it", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 10000 });
    await query("UPDATE pass_types SET fee_paise = 500 WHERE id = $1", [pass]);
    const o = await order(pass, 2);
    expect(o.amountPaise).toBe(2 * (10000 + 500) + 2 * FEE);
    const [row] = await query("SELECT fee_paise FROM orders WHERE id = $1", [o.id]);
    expect(row.fee_paise).toBe(2 * 500 + 2 * FEE);
  });

  it("a retried tap (same idempotency key) returns the same amount, same amount", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 10000 });
    const input = { items: [{ passTypeId: pass, qty: 2 }], buyer: buyer(), idempotencyKey: "retry-1" };
    const a = await reserveOrder(input);
    const b = await reserveOrder(input);
    expect(b.id).toBe(a.id);
    expect(b.amountPaise).toBe(2 * 10000 + 2 * FEE);
  });

  it("is not charged on a completely free order", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 0 });
    const o = await order(pass, 2);
    expect(o.amountPaise).toBe(0);
  });

  it("the amount the buyer is told to pay equals the stored amount", async () => {
    const pass = await makePass(ctx.eventId, 10, { price: 149900 });
    const o = await order(pass, 2);
    const status = (await getOrderStatus(o.id))!;
    expect(status.amountPaise).toBe(2 * 149900 + 2 * FEE);
  });
});
