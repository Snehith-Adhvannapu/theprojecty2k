import { z } from "zod";
import { fail, handle, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { submitProof } from "@/lib/payments/manual";
import { flushOutbox } from "@/lib/email";
import { MAX_PROOF_BYTES } from "@/lib/proof";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    if (!rateLimit(`proof:${clientIp(req)}`, 8, 60_000)) return fail("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);

    let form: FormData;
    try { form = await req.formData(); } catch { return fail("BAD_REQUEST", "Invalid upload.", 400); }
    const file = form.get("proof");
    if (!(file instanceof File)) return fail("BAD_FILE", "Attach your payment screenshot.", 400);
    if (file.size > MAX_PROOF_BYTES) return fail("FILE_TOO_BIG", "That image is too large. Try a smaller screenshot.", 413);

    const result = await submitProof(id, String(form.get("utr") ?? ""), Buffer.from(await file.arrayBuffer()));
    await flushOutbox(id).catch(() => {}); // "we're verifying" email; failures stay queued
    return ok(result);
  });
}
