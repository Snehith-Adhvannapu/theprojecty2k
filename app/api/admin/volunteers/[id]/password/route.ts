import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { resetStaffPassword } from "@/lib/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Not found.", 404);
    const { password } = await body(req, z.object({ password: z.string().min(10, "Use at least 10 characters").max(100) }));
    await resetStaffPassword(staff.id, id, password);
    return ok({});
  });
}
