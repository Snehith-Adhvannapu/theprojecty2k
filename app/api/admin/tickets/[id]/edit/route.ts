import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateGuest } from "@/lib/admin";
import { emailSchema, instagramSchema, phoneSchema } from "@/lib/normalize";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema.nullable().optional().transform((v) => v ?? null),
  instagram: instagramSchema,
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Not found.", 404);
    await updateGuest(staff.id, id, await body(req, schema));
    return ok({});
  });
}
