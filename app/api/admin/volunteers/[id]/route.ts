import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { setStaffActive } from "@/lib/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Not found.", 404);
    const { active } = await body(req, z.object({ active: z.boolean() }));
    await setStaffActive(staff.id, id, active);
    return ok({});
  });
}
