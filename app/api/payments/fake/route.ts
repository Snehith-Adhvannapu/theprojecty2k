// DEV ONLY. Exists so the whole purchase flow can be tried before Razorpay keys exist.
// Hard-disabled unless ALLOW_FAKE_PAYMENTS=1 AND no real Razorpay keys are configured.
import crypto from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { body, handle, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { applyPaymentEvent } from "@/lib/payments";
import { fakePaymentsEnabled } from "@/lib/payments/provider";
import { flushOutbox } from "@/lib/email";

export async function POST(req: Request) {
  return handle(async () => {
    if (!fakePaymentsEnabled()) throw new AppError("NOT_FOUND", "Not found.", 404);
    const { orderId, outcome } = await body(
      req,
      z.object({ orderId: z.string().uuid(), outcome: z.enum(["success", "fail"]) }),
    );
    const [pay] = await query(
      "SELECT provider_order_id, amount_paise FROM payments WHERE order_id = $1 AND provider = 'fake' ORDER BY created_at DESC LIMIT 1",
      [orderId],
    );
    if (!pay) throw new AppError("NOT_FOUND", "No payment started for this order.", 404);
    const id = crypto.randomBytes(8).toString("hex");
    const res = await applyPaymentEvent(
      outcome === "success"
        ? { kind: "captured", eventId: `fake_evt_${id}`, providerOrderId: pay.provider_order_id, providerPaymentId: `pay_fake_${id}`, amountPaise: pay.amount_paise, feePaise: null }
        : { kind: "failed", eventId: `fake_evt_${id}`, providerOrderId: pay.provider_order_id, providerPaymentId: `pay_fake_${id}` },
    );
    if ("orderId" in res) await flushOutbox(res.orderId);
    return ok({ result: res.result });
  });
}
