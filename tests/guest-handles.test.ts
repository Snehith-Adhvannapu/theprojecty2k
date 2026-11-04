import { beforeEach, describe, expect, it } from "vitest";
import { query, transaction } from "@/lib/db";
import { reserveOrder } from "@/lib/inventory";
import { issueTicketsForOrder } from "@/lib/tickets";
import { parseHandles } from "@/lib/normalize";
import { buyer, makePass, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

const reserve = (pass: string, qty: number, guests?: string[], key = `k-${Math.random()}`) =>
  reserveOrder({ items: [{ passTypeId: pass, qty }], buyer: { ...buyer(), instagram: "buyer" }, idempotencyKey: key, guestInstagrams: guests });

describe("guest Instagram handles", () => {
  it("parses a pasted list: @, links, commas, newlines, junk", () => {
    expect(parseHandles("@a, b\nhttps://www.instagram.com/c_d/?hl=en  e.f;  !!!")).toEqual(["a", "b", "c_d", "e.f"]);
  });

  it("needs one handle per extra person", async () => {
    const pass = await makePass(ctx.eventId, 20);
    await expect(reserve(pass, 3, ["a"])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, ["a", "b", "c"])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    await expect(reserve(pass, 3, ["a", "not a handle!!"])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" });
    const o = await reserve(pass, 3, ["@Alice", "https://instagram.com/bob"]);
    expect(o.id).toBeTruthy();
  });

  it("a couple pass counts both people", async () => {
    const pass = await makePass(ctx.eventId, 20, { admits: 2 });
    await expect(reserve(pass, 2, ["a", "b"])).rejects.toMatchObject({ code: "GUESTS_REQUIRED" }); // 4 people, 3 extra handles needed
    expect((await reserve(pass, 2, ["a", "b", "c"])).id).toBeTruthy();
  });

  it("a single ticket needs no guests", async () => {
    const pass = await makePass(ctx.eventId, 20);
    expect((await reserve(pass, 1, [])).id).toBeTruthy();
  });

  it("stores the handles cleaned, and each ticket gets its own", async () => {
    const pass = await makePass(ctx.eventId, 20);
    const o = await reserve(pass, 3, ["@Alice", "https://instagram.com/bob"]);
    await transaction((q) => issueTicketsForOrder(q, o.id));
    const t = await query("SELECT holder_instagram FROM tickets WHERE order_id = $1 ORDER BY created_at, id", [o.id]);
    expect(t.map((r) => r.holder_instagram).sort()).toEqual(["alice", "bob", "buyer"]);
    const [row] = await query("SELECT guest_instagrams FROM orders WHERE id = $1", [o.id]);
    expect(row.guest_instagrams).toEqual(["alice", "bob"]);
  });

  it("a retried tap with the same key returns the same order", async () => {
    const pass = await makePass(ctx.eventId, 20);
    const a = await reserve(pass, 2, ["x"], "same-key-1");
    const b = await reserve(pass, 2, ["x"], "same-key-1");
    expect(b.id).toBe(a.id);
  });
});
