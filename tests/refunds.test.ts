import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { getOrderStatus } from "@/lib/payments";
import { markRefundOwed, markRefunded, refundLedger, rejectOrder, submitProof, approveOrder } from "@/lib/payments/manual";
import { summary } from "@/lib/admin";
import { toCsv } from "@/lib/admin/export";
import { makePass, order, setupDb } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let ctx: Awaited<ReturnType<typeof setupDb>>;
let n = 0;
beforeEach(async () => { ctx = await setupDb(); });
async function submitted(pass: string, qty = 1) { const o = await order(pass, qty); await submitProof(o.id, String(410000000000 + n++), PNG); return o; }

describe("rejecting a person whose money arrived", () => {
  it("'reject & refund' frees the pass, lists the refund, and tracks it through to refunded with the method", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const o = await submitted(pass);
    expect(await rejectOrder(o.id, ctx.staffId, "We couldn't verify your profile", false, true)).toEqual({ result: "needs_refund" });
    expect((await getOrderStatus(o.id))?.status).toBe("needs_refund");
    await expect(order(pass, 1)).resolves.toBeTruthy(); // the pass is free again
    let l = await refundLedger();
    expect(l.totals).toMatchObject({ owedCount: 1, refundedCount: 0 });
    expect(l.owed[0].reason).toBe("We couldn't verify your profile");
    const s1 = await summary();
    expect(s1.money.owed).toBe(l.totals.owedPaise);
    expect(s1.money.inBank).toBe(s1.money.gross + s1.money.owed);

    await markRefunded(o.id, ctx.staffId, { method: "whatsapp", reference: "UPI123", note: "sent to their other UPI ID" });
    await markRefunded(o.id, ctx.staffId, { method: "upi" }); // second tap changes nothing
    l = await refundLedger();
    expect(l.totals).toMatchObject({ owedCount: 0, refundedCount: 1 });
    expect(l.done[0]).toMatchObject({ method: "whatsapp", reference: "UPI123" });
    const [{ c }] = await query("SELECT count(*)::int AS c FROM refunds WHERE order_id = $1", [o.id]);
    expect(c).toBe(1);
    expect((await summary()).money.refunds).toBe(l.totals.refundedPaise);
    expect((await getOrderStatus(o.id))?.status).toBe("refunded");
    const csv = await toCsv("refunds");
    expect(csv).toContain("UPI123");
    expect(csv).toContain("Refunded");
  });

  it("an earlier final rejection can be moved to the refund list; an unpaid or approved order cannot", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const a = await submitted(pass);
    await rejectOrder(a.id, ctx.staffId, "Not a match", false);
    await markRefundOwed(a.id, ctx.staffId);
    await markRefundOwed(a.id, ctx.staffId); // idempotent
    expect((await refundLedger()).totals.owedCount).toBe(1);
    const b = await submitted(pass);
    await expect(markRefundOwed(b.id, ctx.staffId)).rejects.toMatchObject({ code: "NOT_REJECTED" });
    await approveOrder(b.id, ctx.staffId);
    await expect(markRefunded(b.id, ctx.staffId, { method: "upi" })).rejects.toMatchObject({ code: "NOT_REFUNDABLE" });
  });
});
