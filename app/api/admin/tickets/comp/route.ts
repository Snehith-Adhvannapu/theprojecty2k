import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { compTicket } from "@/lib/admin";
import { emailSchema, instagramSchema, phoneSchema } from "@/lib/normalize";

const schema = z.object({
  passTypeId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema.nullable().optional().transform((v) => v ?? null),
  instagram: instagramSchema,
  reason: z.string().trim().min(3, "A reason is required").max(200),
});

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    return ok(await compTicket(staff.id, await body(req, schema)));
  });
}
