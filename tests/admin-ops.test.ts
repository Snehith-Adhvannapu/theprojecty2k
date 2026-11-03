import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { checkIn } from "@/lib/checkin";
import { tokenForTicket } from "@/lib/tickets";
import { listPublicPasses } from "@/lib/inventory";
import { retryFailedEmails, undoCheckin, updateGuest } from "@/lib/admin";
import { getSales, setSalesPaused } from "@/lib/sales";
import { makePass, order, paidOrder, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => {
  ctx = await setupDb();
  await setSalesPaused(ctx.staffId, false);
});

async function ticketOf(passId: string) {
  const { order: o } = await paidOrder(passId, 1);
  const [t] = await query("SELECT id FROM tickets WHERE order_id = $1", [o.id]);
  return { orderId: o.id, id: t.id as string, token: tokenForTicket(t.id) };
}

describe("admin event operations", () => {
  it("fixing a typo changes the name at the door and the email the ticket goes to, and logs the fields not the values", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const t = await ticketOf(pass);
    await updateGuest(ctx.staffId, t.id, { name: "Asha Rao", phone: "+919876543210", email: "Asha@Example.com", instagram: "asha" });
    const [row] = await query("SELECT holder_name, holder_phone, holder_email, holder_instagram FROM tickets WHERE id = $1", [t.id]);
    expect(row).toMatchObject({ holder_name: "Asha Rao", holder_phone: "+919876543210", holder_email: "asha@example.com", holder_instagram: "asha" });
    const [o] = await query("SELECT buyer_email FROM orders WHERE id = $1", [t.orderId]);
    expect(o.buyer_email).toBe("asha@example.com");
    const log = JSON.stringify(await query("SELECT action, meta FROM audit_logs WHERE action = 'guest_edited'"));
    expect(log).toContain("guest_edited");
    expect(log).not.toContain("9876543210");
    expect(log).not.toContain("asha@example.com");
    await expect(updateGuest(ctx.staffId, "00000000-0000-0000-0000-000000000000", { name: "X Y", phone: "+919876543210", email: null, instagram: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a mistaken check-in can be undone, once, and the ticket scans again", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const t = await ticketOf(pass);
    expect((await checkIn({ token: t.token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("admitted");
    expect((await checkIn({ token: t.token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("duplicate");
    await undoCheckin(ctx.staffId, t.id);
    await expect(undoCheckin(ctx.staffId, t.id)).rejects.toMatchObject({ code: "NOT_USED" }); // already valid again
    expect((await checkIn({ token: t.token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("admitted");
  });

  it("pausing sales stops new orders and shows passes as not on sale; resuming restores them; existing tickets are untouched", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const t = await ticketOf(pass);
    await setSalesPaused(ctx.staffId, true);
    expect(await getSales()).toEqual({ paused: true });
    await expect(order(pass, 1)).rejects.toMatchObject({ code: "SALES_PAUSED" });
    expect((await listPublicPasses())[0].onSale).toBe(false);
    expect((await checkIn({ token: t.token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("admitted");
    await setSalesPaused(ctx.staffId, false);
    expect((await listPublicPasses())[0].onSale).toBe(true);
    await expect(order(pass, 1)).resolves.toMatchObject({ status: "pending" });
  });

  it("failed emails go back in the queue", async () => {
    await query("INSERT INTO email_outbox (to_email, kind, status, attempts, last_error) VALUES ('a@b.co','ticket','failed',5,'boom')");
    expect(await retryFailedEmails(ctx.staffId)).toBe(1);
    const [r] = await query("SELECT status, attempts, last_error FROM email_outbox");
    expect(r).toMatchObject({ status: "pending", attempts: 0, last_error: null });
  });
});
