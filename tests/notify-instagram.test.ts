import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db";
import { getOrderStatus } from "@/lib/payments";
import { submitProof } from "@/lib/payments/manual";
import { notifyNewPayment } from "@/lib/notify";
import { requiredInstagramSchema } from "@/lib/normalize";
import { ticketPdf } from "@/lib/tickets/pdf";
import { makePass, order, setupDb } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("instagram is required at checkout", () => {
  it("refuses empty and nonsense, strips @ and URLs", () => {
    for (const bad of ["", "   ", undefined, "not a handle!!", "@"]) expect(requiredInstagramSchema.safeParse(bad).success).toBe(false);
    expect(requiredInstagramSchema.parse(" @The.Project_Y2K ")).toBe("the.project_y2k");
    expect(requiredInstagramSchema.parse("https://instagram.com/some.one/")).toBe("some.one");
  });
});

describe("order status for the waiting page", () => {
  it("tells the buyer where the ticket will be emailed, masked", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 1);
    const s = await getOrderStatus(o.id);
    expect(s?.emailMasked).toBe("b***@test.dev");
    expect(JSON.stringify(s)).not.toContain("buyer@test.dev");
  });
});

describe("admin alert when a payment is submitted", () => {
  it("never throws without any channel configured", async () => {
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 1);
    await submitProof(o.id, "123456789012", PNG);
    await expect(notifyNewPayment(o.id)).resolves.toBeUndefined();
  });

  it("emails the organiser a deep link with amount and UTR tail only: no phone, no full UTR", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Y2K <t@example.com>");
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "boss@example.com");
    vi.stubEnv("APP_URL", "https://www.example.com");
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: { body?: string }) => { bodies.push(init?.body ?? ""); return new Response("{}", { status: 200 }); }));
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 1);
    await submitProof(o.id, "123456789012", PNG);
    await notifyNewPayment(o.id);
    const mail = bodies.find((b) => b.includes("boss@example.com"));
    expect(mail).toBeTruthy();
    expect(mail).toContain(`https://www.example.com/admin?tab=payments&order=${o.id}`);
    expect(mail).toContain("9012");
    expect(mail).not.toContain("123456789012");
    expect(mail).not.toMatch(/9000\d{6}/);
  });

  it("a failing email does not break the caller", async () => {
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const pass = await makePass(ctx.eventId, 5);
    const o = await order(pass, 1);
    await submitProof(o.id, "123456789012", PNG);
    await expect(notifyNewPayment(o.id)).resolves.toBeUndefined();
  });
});

describe("ticket pdf with the logo", () => {
  it("renders a PDF that embeds the Y2K26 logo", async () => {
    const bytes = await ticketPdf({ token: "t".repeat(43), shortCode: "Y2K-ABCDEF", admits: 1, passName: "Early Bird Pass", holderName: "Asha Rao" });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Subtype /Image");
  });
});
