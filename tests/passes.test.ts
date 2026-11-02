import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { listPasses, upsertPass } from "@/lib/admin";
import { availability } from "@/lib/inventory";
import { makePass, order, paidOrder, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => {
  ctx = await setupDb();
});

const input = (id: string, totalQty: number) => ({
  id, name: "General", description: "", pricePaise: 10000, feePaise: 0, totalQty, admits: 1, active: true, sort: 0, salesStart: null, salesEnd: null,
});

describe("pass quantities", () => {
  it("raising the total opens stock at once; the list reports sold and held", async () => {
    const pass = await makePass(ctx.eventId, 2);
    await paidOrder(pass, 1);
    await order(pass, 1, "+919000011111"); // held, unpaid
    await expect(order(pass, 1, "+919000022222")).rejects.toMatchObject({ code: "SOLD_OUT" });
    const [row] = await listPasses();
    expect(row.sold).toBe(1);
    expect(row.held).toBe(1);
    await upsertPass(ctx.staffId, input(pass, 5));
    await expect(order(pass, 1, "+919000033333")).resolves.toBeTruthy();
    expect((await listPasses())[0].totalQty).toBe(5);
  });

  it("cannot lower the total below what is already sold", async () => {
    const pass = await makePass(ctx.eventId, 5);
    await paidOrder(pass, 2);
    await expect(upsertPass(ctx.staffId, input(pass, 1))).rejects.toMatchObject({ code: "BELOW_SOLD" });
    await expect(upsertPass(ctx.staffId, input(pass, 2))).resolves.toBe(pass);
  });

  it("lowering below sold + held is allowed; held buyers simply find it sold out and are never double-sold", async () => {
    const pass = await makePass(ctx.eventId, 5);
    await paidOrder(pass, 1);
    await order(pass, 2, "+919000044444");
    await upsertPass(ctx.staffId, input(pass, 2));
    expect(await availability({ query }, pass)).toBeLessThanOrEqual(0);
    const [{ n }] = await query("SELECT count(*)::int AS n FROM tickets");
    expect(n).toBe(1);
  });
});
