import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { bodyToHtml, fill, recipients, render } from "@/lib/admin/broadcast";
import { makePass, order, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

const F = { sold: 120, left: 30 };

describe("email update: text", () => {
  it("fills the placeholders per person", () => {
    expect(fill("Hi [name], [sold] in, [left] left", { name: "Aarav Mehta" }, F)).toBe("Hi Aarav, 120 in, 30 left");
    expect(fill("Hi [name]", { name: "" }, F)).toBe("Hi there");
  });
  it("cannot inject markup", () => {
    const h = bodyToHtml('<script>alert(1)</script> **bold** https://projecty2k.com/x.');
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
    expect(h).toContain("<strong>bold</strong>");
    expect(h).toContain('href="https://projecty2k.com/x"');
  });
  it("one subject line, even if a newline is pasted in", () => {
    expect(render({ subject: "A\nB [sold]", body: "hello there", button: false }, { name: "X" }, F).subject).toBe("A B 120");
  });
  it("adds the button only when asked", () => {
    expect(render({ subject: "Hi", body: "hello there", button: true }, { name: "X" }, F).html).toContain("GET YOUR PASS");
    expect(render({ subject: "Hi", body: "hello there", button: false }, { name: "X" }, F).html).not.toContain("GET YOUR PASS");
  });
});

describe("email update: audiences", () => {
  it("lists each address once, by group", async () => {
    const pass = await makePass(ctx.eventId, 10);
    const a = await order(pass, 1, "+919000000001");
    const b = await order(pass, 1, "+919000000002");
    await query("UPDATE orders SET buyer_email = 'a@test.dev', status = 'paid' WHERE id = $1", [a.id]);
    await query("UPDATE orders SET buyer_email = 'B@Test.dev', status = 'pending' WHERE id = $1", [b.id]);
    expect((await recipients("holders")).map((r) => r.email)).toEqual(["a@test.dev"]);
    expect((await recipients("not_bought")).map((r) => r.email)).toEqual(["b@test.dev"]);
    expect((await recipients("registered")).map((r) => r.email).sort()).toEqual(["a@test.dev", "b@test.dev"]);
  });
});
