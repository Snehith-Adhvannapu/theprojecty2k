import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { aboutSchema, getAbout, resetAbout, saveAbout } from "@/lib/site-content";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await getAbout(), { headers: { "Cache-Control": "no-store" } });
  });
}

const post = z.union([aboutSchema, z.object({ reset: z.literal(true) })]);

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const b = await body(req, post);
    return ok("reset" in b ? await resetAbout(staff.id) : await saveAbout(staff.id, b));
  });
}
