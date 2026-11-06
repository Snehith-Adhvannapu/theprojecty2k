import { beforeEach, describe, expect, it } from "vitest";
import { query, transaction } from "@/lib/db";
import { reserveOrder } from "@/lib/inventory";
import { issueTicketsForOrder, queueTicketEmails, ticketsForOrder } from "@/lib/tickets";
import { cleanPerson } from "@/lib/normalize";
import { buyer, makePass, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

const person = (n: string, over: Partial<Record<"name" | "email" | "phone" | "instagram", string>> = {}) =>
  ({ name: `Guest ${n}`, email: `Guest.${n}@Example.com`, phone: `98765432${String(n).padStart(2, "0")}`, instagram: `@${n}`, ...over });

const reserve = (pass: string, qty: number, guests?: ReturnType<typeof person>[], key = `k-${Math.random()}`) =>
  reserveOrder({ items: [{ passTypeId: pass, qty }], buyer: { ...buyer(), instagram: "buyer" }, idempotencyKey: key, guests });

describe("everyone on the order: name, email, phone, Instagram", () => {
  it("cleans a person and rejects any missing or malformed field", () => {
    expect(cleanPerson({ name: "  Asha   Rao ", email: " ASHA@Example.COM", phone: "98765 43210", instagram: "https://instagram.com/Asha_r/" }))
      .toEqual({ name: "Asha Rao", email: "asha@example.com", phone: "+919876543210", instagram: "asha_r" });
    expect(cleanPerson({ name: "A", email: "a@b.co", phone: "9876543210", instagram: "a" })).toBeNull();
    expect(cleanPerson({ name: "Asha", email: "nope", phone: "9876543210", instagram: "a" })).toBeNull();
    expect(cleanPerson({ name: "Asha", email: "a@b.co", phone: "12345", instagram: "a" })).toBeNull();
    expect(cleanPerson({ name: "Asha", email: "a@b.co", phone: "9876543210", instagram: "" })).toBeNull();
  });

  it("needs one complete person per extra person", async () => {
    const pass = await makePass(ctx.eventId, 20);
    await expect(reserve(pass, 3, [person("1")])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, [person("1"), person("2"), person("3")])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, [person("1"), person("2", { email: "broken" })])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, [person("1"), person("2", { phone: "123" })])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, [person("1"), person("2", { name: "" })])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    expect((await reserve(pass, 3, [person("1"), person("2")])).id).toBeTruthy();
  });

  it("a couple pass counts both people", async () => {
    const pass = await makePass(ctx.eventId, 20, { admits: 2 });
    await expect(reserve(pass, 2, [person("1"), person("2")])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" }); // 4 people, 3 extra needed
    expect((await reserve(pass, 2, [person("1"), person("2"), person("3")])).id).toBeTruthy();
  });

  it("a single ticket needs no guests", async () => {
    const pass = await makePass(ctx.eventId, 20);
    expect((await reserve(pass, 1, [])).id).toBeTruthy();
  });

  it("a retried tap with the same key returns the same order", async () => {
    const pass = await makePass(ctx.eventId, 20);
    const a = await reserve(pass, 2, [person("1")], "same-key-1");
    const b = await reserve(pass, 2, [person("1")], "same-key-1");
    expect(b.id).toBe(a.id);
  });
});

describe("one ticket per person", () => {
  it("separate passes: each ticket is made out to its own person", async () => {
    const pass = await makePass(ctx.eventId, 20);
    const o = await reserve(pass, 3, [person("1"), person("2")]);
    await transaction((q) => issueTicketsForOrder(q, o.id));
    const t = await query("SELECT holder_name, holder_email, holder_phone, holder_instagram, admits FROM tickets WHERE order_id = $1 ORDER BY holder_name", [o.id]);
    expect(t).toHaveLength(3);
    expect(t.every((r) => r.admits === 1)).toBe(true);
    expect(t.map((r) => r.holder_instagram).sort()).toEqual(["1", "2", "buyer"]);
    expect(t.find((r) => r.holder_name === "Guest 1")).toMatchObject({ holder_email: "guest.1@example.com", holder_phone: "+919876543201" });
  });

  it("a couple pass gives two QR tickets, one per person, admitting one each", async () => {
    const pass = await makePass(ctx.eventId, 20, { admits: 2 });
    const o = await reserve(pass, 1, [person("7")]);
    await transaction((q) => issueTicketsForOrder(q, o.id));
    const t = await query("SELECT holder_name, admits FROM tickets WHERE order_id = $1", [o.id]);
    expect(t).toHaveLength(2);
    expect(t.every((r) => r.admits === 1)).toBe(true);
    expect(t.map((r) => r.holder_name)).toContain("Guest 7");
    // Stock still counts passes, not people: one couple pass sold = 1 unit used.
    const [av] = await query("SELECT total_qty FROM pass_types WHERE id = $1", [pass]);
    expect(av.total_qty).toBe(20);
  });

  it("each person is emailed only their own ticket; the buyer gets all; one email per address", async () => {
    const pass = await makePass(ctx.eventId, 20);
    const b = buyer();
    // buyer email reused for guest 2: still only one email to that address
    const o = await reserve(pass, 3, [person("1"), person("2", { email: b.email })]);
    await transaction(async (q) => { await issueTicketsForOrder(q, o.id); await queueTicketEmails(q, o.id); });
    const rows = await query("SELECT to_email FROM email_outbox WHERE order_id = $1 AND kind = 'ticket' ORDER BY to_email", [o.id]);
    expect(rows.map((r) => r.to_email).sort()).toEqual([b.email.toLowerCase(), "guest.1@example.com"].sort());
    expect(await ticketsForOrder({ query }, o.id)).toHaveLength(3);
    expect(await ticketsForOrder({ query }, o.id, "guest.1@example.com")).toHaveLength(1);
  });

  it("older orders without per-person details still issue one ticket per pass", async () => {
    const pass = await makePass(ctx.eventId, 20, { admits: 2 });
    const o = await reserve(pass, 1); // no guests given: legacy path
    await transaction((q) => issueTicketsForOrder(q, o.id));
    const t = await query("SELECT admits FROM tickets WHERE order_id = $1", [o.id]);
    expect(t).toHaveLength(1);
    expect(t[0].admits).toBe(2);
  });
});
