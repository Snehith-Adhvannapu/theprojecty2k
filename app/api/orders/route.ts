import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { reserveOrder } from "@/lib/inventory";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { emailSchema, phoneSchema, requiredInstagramSchema } from "@/lib/normalize";

const schema = z.object({
  passTypeId: z.string().uuid(),
  qty: z.number().int().min(1).max(15),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneSchema,
  email: emailSchema,
  instagram: requiredInstagramSchema,
  idempotencyKey: z.string().min(8).max(80),
  accepted: z.literal(true, { error: "Please accept the terms" }),
});

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`order:${clientIp(req)}`, 12, 60_000)) {
      return fail("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);
    }
    const d = await body(req, schema);
    const o = await reserveOrder({
      items: [{ passTypeId: d.passTypeId, qty: d.qty }],
      buyer: { name: d.name, phone: d.phone, email: d.email, instagram: d.instagram },
      idempotencyKey: d.idempotencyKey,
    });
    return ok({ id: o.id, amountPaise: o.amountPaise, expiresAt: o.expiresAt });
  });
}
