import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { reserveOrder } from "@/lib/inventory";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { emailSchema, phoneSchema, requiredInstagramSchema } from "@/lib/normalize";

const personSchema = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().max(120).default(""),
  phone: z.string().max(20).default(""),
  instagram: z.string().max(120).default(""),
});

const schema = z.object({
  passTypeId: z.string().uuid(),
  qty: z.number().int().min(1).max(15),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneSchema,
  email: emailSchema,
  instagram: requiredInstagramSchema,
  guests: z.array(personSchema).max(40).default([]),
  permission: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(80),
  accepted: z.literal(true, { error: "Please accept the terms" }),
});

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`order:${clientIp(req)}`, 12, 60_000)) {
      return fail("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);
    }
    const d = await body(req, schema);
    if (d.guests.length > 0 && !d.permission) return fail("PERMISSION", "Please confirm you have permission to share the other people's details.", 400);
    const o = await reserveOrder({
      items: [{ passTypeId: d.passTypeId, qty: d.qty }],
      buyer: { name: d.name, phone: d.phone, email: d.email, instagram: d.instagram },
      guests: d.guests,
      idempotencyKey: d.idempotencyKey,
    });
    return ok({ id: o.id, amountPaise: o.amountPaise, expiresAt: o.expiresAt });
  });
}
