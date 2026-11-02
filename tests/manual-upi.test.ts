import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { getOrderStatus } from "@/lib/payments";
import { approveOrder, markRefunded, rejectOrder, reviewQueue, submitProof } from "@/lib/payments/manual";
import { sniffImage } from "@/lib/proof";
import { ticketPdf } from "@/lib/tickets/pdf";
import { makePass, order, setupDb } from "./helpers";

// 1x1 PNG: real magic bytes, tiny.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let n = 0;
const utr = () => String(300000000000 + n++);

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => {
  ctx = await setupDb();
});

async function submitted(pass: string, qty = 1, u = utr()) {
  const o = await order(pass, qty);
  await submitProof(o.id, u, PNG);
  return { o, u };
}

describe("submit proof", () => {
  it("moves a pending order to awaiting_review and keeps the stock held", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const { o } = await submitted(pass);
    expect((await getOrderStatus(o.id))?.status).toBe("awaiting_review");
    await expect(order(pass, 1)).rejects.toMatchObject({ code: "SOLD_OUT" });
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(0); // a screenshot alone never creates a ticket
  });

  it("rejects malformed UTRs and non-images", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const o = await order(pass, 1);
    await expect(submitProof(o.id, "12345", PNG)).rejects.toThrow();
    await expect(submitProof(o.id, utr(), Buffer.from("not an image at all, just text"))).rejects.toMatchObject({ code: "BAD_FILE" });
    expect(sniffImage(PNG)).toBe("image/png");
  });

  it("the same UTR cannot be used on two orders", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const a = await order(pass, 1);
    const b = await order(pass, 1);
    const u = utr();
    await submitProof(a.id, u, PNG);
    await expect(submitProof(b.id, u, PNG)).rejects.toMatchObject({ code: "UTR_USED" });
  });

  it("an order cannot be submitted twice", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const { o } = await submitted(pass);
    await expect(submitProof(o.id, utr(), PNG)).rejects.toMatchObject({ code: "ALREADY_SUBMITTED" });
  });

  it("a late submission after the hold expired fails when the stock is gone", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const o = await order(pass, 1);
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [o.id]);
    await order(pass, 1); // someone else takes the freed pass
    await expect(submitProof(o.id, utr(), PNG)).rejects.toMatchObject({ code: "SOLD_OUT" });
  });
});

describe("approve / reject", () => {
  it("approve issues tickets, records the payment, queues the email", async () => {
    const pass = await makePass(ctx.eventId, 3, { admits: 2 });
    const { o, u } = await submitted(pass, 2);
    expect(await approveOrder(o.id, ctx.staffId)).toEqual({ result: "approved" });
    const s = await getOrderStatus(o.id);
    expect(s?.status).toBe("paid");
    expect(s?.tickets).toHaveLength(2);
    const [p] = await query("SELECT provider, provider_payment_id, status, amount_paise FROM payments WHERE order_id = $1", [o.id]);
    expect(p).toMatchObject({ provider: "upi_manual", provider_payment_id: u, status: "captured", amount_paise: o.amountPaise });
    const mail = await query("SELECT kind FROM email_outbox WHERE order_id = $1 ORDER BY created_at", [o.id]);
    expect(mail.map((m) => m.kind)).toEqual(["received", "ticket"]);
  });

  it("approving the same order 5 times in parallel creates exactly one set of tickets", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const { o } = await submitted(pass);
    const res = await Promise.all(Array.from({ length: 5 }, () => approveOrder(o.id, ctx.staffId)));
    expect(res.filter((r) => r.result === "approved")).toHaveLength(1);
    expect(res.filter((r) => r.result === "already_approved")).toHaveLength(4);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets WHERE order_id = $1", [o.id]);
    expect(n).toBe(1);
    const [{ p }] = await query("SELECT count(*)::int AS p FROM payments WHERE order_id = $1", [o.id]);
    expect(p).toBe(1);
  });

  it("an approval that finds no stock becomes needs_refund, never a dropped payment", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const { o } = await submitted(pass);
    await query("UPDATE pass_types SET total_qty = 0 WHERE id = $1", [pass]); // admin shrank capacity
    expect(await approveOrder(o.id, ctx.staffId)).toEqual({ result: "needs_refund" });
    expect((await getOrderStatus(o.id))?.status).toBe("needs_refund");
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(0);
  });

  it("marking a needs_refund order refunded is idempotent, audited, and only valid from needs_refund", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const { o } = await submitted(pass);
    await expect(markRefunded(o.id, ctx.staffId)).rejects.toMatchObject({ code: "NOT_REFUNDABLE" });
    await query("UPDATE pass_types SET total_qty = 0 WHERE id = $1", [pass]);
    await approveOrder(o.id, ctx.staffId);
    await Promise.all([markRefunded(o.id, ctx.staffId), markRefunded(o.id, ctx.staffId)]);
    expect((await getOrderStatus(o.id))?.status).toBe("refunded");
    const [{ n }] = await query("SELECT count(*)::int AS n FROM audit_logs WHERE action = 'marked_refunded'");
    expect(n).toBe(1);
    await expect(markRefunded("00000000-0000-0000-0000-000000000000", ctx.staffId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("an unsubmitted order cannot be approved", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const o = await order(pass, 1);
    await expect(approveOrder(o.id, ctx.staffId)).rejects.toMatchObject({ code: "NOT_AWAITING" });
  });

  it("reject with resubmit returns the order to pending, frees the UTR, keeps the reason", async () => {
    const pass = await makePass(ctx.eventId, 3);
    const { o, u } = await submitted(pass);
    expect(await rejectOrder(o.id, ctx.staffId, "Screenshot is blurry", true)).toEqual({ result: "resubmit" });
    const s = await getOrderStatus(o.id);
    expect(s?.status).toBe("pending");
    expect(s?.reviewNote).toBe("Screenshot is blurry");
    await expect(submitProof(o.id, u, PNG)).resolves.toEqual({ status: "awaiting_review" });
  });

  it("a final rejection frees the stock and the UTR", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const { o, u } = await submitted(pass);
    await rejectOrder(o.id, ctx.staffId, "Amount does not match the bank", false);
    expect((await getOrderStatus(o.id))?.status).toBe("rejected");
    const b = await order(pass, 1); // stock is free again
    await expect(submitProof(b.id, u, PNG)).resolves.toBeTruthy(); // rejected UTR no longer blocks
  });

  it("the review queue lists pending first and history separately", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const a = await submitted(pass);
    const b = await submitted(pass);
    await approveOrder(b.o.id, ctx.staffId);
    const q = await reviewQueue();
    expect(q.pending.map((r) => r.id)).toEqual([a.o.id]);
    expect(q.reviewed[0]).toMatchObject({ id: b.o.id, status: "paid" });
    expect(q.reviewed[0].ticketToken).toBeTruthy();
  });
});

describe("ticket pdf", () => {
  it("renders a real PDF", async () => {
    const bytes = await ticketPdf({ token: "x".repeat(43), shortCode: "Y2K-ABCDEF", admits: 2, passName: "Couple", holderName: "A B" });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("changing a rejection to approved (buyer confirmed by phone)", () => {
  it("issues the ticket, shows as reversible in the queue, and is idempotent", async () => {
    const pass = await makePass(ctx.eventId, 2);
    const { o } = await submitted(pass);
    await rejectOrder(o.id, ctx.staffId, "Could not find the payment", false);
    const q = await reviewQueue();
    expect(q.reviewed.find((r) => r.id === o.id)?.canReverse).toBe(true);
    expect((await approveOrder(o.id, ctx.staffId)).result).toBe("approved");
    expect((await getOrderStatus(o.id))?.status).toBe("paid");
    expect((await approveOrder(o.id, ctx.staffId)).result).toBe("already_approved");
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets WHERE order_id = $1", [o.id]);
    expect(n).toBe(1);
  });

  it("goes to needs_refund when the stock was taken after the rejection", async () => {
    const pass = await makePass(ctx.eventId, 1);
    const { o } = await submitted(pass);
    await rejectOrder(o.id, ctx.staffId, "Could not find the payment", false);
    await submitted(pass); // someone else takes the freed pass
    expect((await approveOrder(o.id, ctx.staffId)).result).toBe("needs_refund");
  });
});
