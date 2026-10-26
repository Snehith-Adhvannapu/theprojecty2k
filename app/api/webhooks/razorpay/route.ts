import crypto from "node:crypto";
import { fail, handle, ok } from "@/lib/api";
import { applyPaymentEvent } from "@/lib/payments";
import { parseRazorpayEvent, verifyRazorpaySignature } from "@/lib/payments/provider";
import { flushOutbox } from "@/lib/email";

export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.text(); // RAW body: the signature is over these exact bytes
    if (!verifyRazorpaySignature(raw, req.headers.get("x-razorpay-signature"))) {
      return fail("BAD_SIGNATURE", "Invalid signature.", 400);
    }
    const eventId =
      req.headers.get("x-razorpay-event-id") ?? `body:${crypto.createHash("sha256").update(raw).digest("hex")}`;
    const ev = parseRazorpayEvent(raw, eventId);
    if (!ev) return ok({ ignored: true }); // events we don't act on still get a 200
    const res = await applyPaymentEvent(ev);
    // duplicates and no-ops are 200s too: the gateway must stop retrying
    if ("orderId" in res) await flushOutbox(res.orderId);
    return ok({ result: res.result });
  });
}
