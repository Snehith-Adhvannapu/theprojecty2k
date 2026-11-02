import crypto from "node:crypto";
import { AppError } from "@/lib/errors";

// What the rest of the app sees, regardless of gateway.
export type PaymentEvent =
  | { kind: "captured"; eventId: string; providerOrderId: string; providerPaymentId: string; amountPaise: number; feePaise: number | null }
  | { kind: "failed"; eventId: string; providerOrderId: string; providerPaymentId: string }
  | { kind: "refunded"; eventId: string; providerPaymentId: string; refundAmountPaise: number };

export interface PaymentProvider {
  name: "razorpay" | "fake";
  createOrder(amountPaise: number, receipt: string): Promise<{ providerOrderId: string }>;
  /** Server-side fetch: the captured payment for this gateway order, if any. */
  fetchCapturedPayment(
    providerOrderId: string,
  ): Promise<{ paymentId: string; amountPaise: number; feePaise: number | null } | null>;
}

const RZP = "https://api.razorpay.com/v1";

function razorpay(keyId: string, keySecret: string): PaymentProvider {
  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  async function call(path: string, init?: RequestInit) {
    const res = await fetch(`${RZP}${path}`, {
      ...init,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError("GATEWAY_ERROR", "Payment gateway error. Please try again.", 502);
    return body;
  }
  return {
    name: "razorpay",
    async createOrder(amountPaise, receipt) {
      const o = await call("/orders", {
        method: "POST",
        body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt }),
      });
      return { providerOrderId: o.id as string };
    },
    async fetchCapturedPayment(providerOrderId) {
      const r = await call(`/orders/${encodeURIComponent(providerOrderId)}/payments`);
      const p = (r.items ?? []).find((x: { status: string }) => x.status === "captured");
      return p ? { paymentId: p.id, amountPaise: p.amount, feePaise: p.fee ?? null } : null;
    },
  };
}

// Dev-only stand-in so the whole flow works before Razorpay keys exist.
// Refuses to exist unless ALLOW_FAKE_PAYMENTS=1 and no real keys are configured.
function fake(): PaymentProvider {
  return {
    name: "fake",
    async createOrder() {
      return { providerOrderId: `order_fake_${crypto.randomBytes(8).toString("hex")}` };
    },
    async fetchCapturedPayment() {
      return null; // fake payments are confirmed by the fake sheet itself
    },
  };
}

export function getProvider(): PaymentProvider {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (id && secret) return razorpay(id, secret);
  if (process.env.ALLOW_FAKE_PAYMENTS === "1") return fake();
  throw new AppError("PAYMENTS_NOT_CONFIGURED", "Payments are not configured yet.", 503);
}

// Never in a production build, even if ALLOW_FAKE_PAYMENTS is set by mistake.
export const fakePaymentsEnabled = () =>
  process.env.NODE_ENV !== "production" && !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) && process.env.ALLOW_FAKE_PAYMENTS === "1";

/** Constant-time HMAC check over the RAW body. */
export function verifyRazorpaySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Turns a Razorpay webhook payload into our normalised event, or null if we don't act on it. */
export function parseRazorpayEvent(rawBody: string, eventId: string): PaymentEvent | null {
  let body: {
    event?: string;
    payload?: {
      payment?: { entity?: { id: string; order_id?: string; amount: number; fee?: number } };
      refund?: { entity?: { payment_id: string; amount: number } };
    };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const pay = body.payload?.payment?.entity;
  switch (body.event) {
    case "payment.captured":
      if (!pay?.order_id) return null;
      return {
        kind: "captured", eventId, providerOrderId: pay.order_id, providerPaymentId: pay.id,
        amountPaise: pay.amount, feePaise: pay.fee ?? null,
      };
    case "payment.failed":
      if (!pay?.order_id) return null;
      return { kind: "failed", eventId, providerOrderId: pay.order_id, providerPaymentId: pay.id };
    case "refund.processed": {
      const r = body.payload?.refund?.entity;
      if (!r) return null;
      return { kind: "refunded", eventId, providerPaymentId: r.payment_id, refundAmountPaise: r.amount };
    }
    default:
      return null;
  }
}
