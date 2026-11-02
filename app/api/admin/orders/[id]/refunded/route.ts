import { z } from "zod";
import { fail, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { markRefunded } from "@/lib/payments/manual";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    await markRefunded(id, staff.id);
    return ok({});
  });
}
