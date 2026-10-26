import { describe, expect, it } from "vitest";
import { normalizeInstagram, normalizePhone } from "@/lib/normalize";
import { generateShortCode, parseShortCode } from "@/lib/tickets";
import { verifyRazorpaySignature } from "@/lib/payments/provider";
import crypto from "node:crypto";

describe("normalisation", () => {
  it("phones to +91 E.164", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
  });
  it("instagram handles lose @ and URLs", () => {
    expect(normalizeInstagram("@Some.User")).toBe("some.user");
    expect(normalizeInstagram("https://www.instagram.com/some.user/?hl=en")).toBe("some.user");
    expect(normalizeInstagram("")).toBeNull();
    expect(normalizeInstagram("bad handle!")).toBeNull();
  });
});

describe("short codes", () => {
  it("generated codes validate and use no ambiguous symbols", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateShortCode();
      expect(c).toMatch(/^Y2K-[2-9A-HJKMNP-Z]{6}$/);
      expect(parseShortCode(c)).toBe(c);
    }
  });
  it("accepts sloppy input, rejects a single-character typo", () => {
    const c = generateShortCode();
    expect(parseShortCode(c.toLowerCase().replace("-", " "))).toBe(c);
    const body = c.slice(4);
    const swapped = body[0] === "2" ? "3" + body.slice(1) : "2" + body.slice(1);
    expect(parseShortCode("Y2K-" + swapped)).toBeNull();
  });
});

describe("razorpay webhook signature", () => {
  it("accepts a correct HMAC over the raw body and rejects anything else", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
    const body = '{"event":"payment.captured"}';
    const sig = crypto.createHmac("sha256", "whsec_test").update(body).digest("hex");
    expect(verifyRazorpaySignature(body, sig)).toBe(true);
    expect(verifyRazorpaySignature(body + " ", sig)).toBe(false);
    expect(verifyRazorpaySignature(body, null)).toBe(false);
    expect(verifyRazorpaySignature(body, "00")).toBe(false);
  });
});
