import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createVolunteer, listVolunteers } from "@/lib/admin";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(10, "Use at least 10 characters").max(100),
  role: z.enum(["volunteer", "admin"]).default("volunteer"),
});

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await listVolunteers(), { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    return ok({ id: await createVolunteer(staff.id, await body(req, schema)) });
  });
}
