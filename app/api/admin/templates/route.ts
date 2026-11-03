import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getWaTemplates, saveWaTemplates, waTemplatesSchema } from "@/lib/wa-templates";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await getWaTemplates(), { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    return ok(await saveWaTemplates(staff.id, await body(req, waTemplatesSchema)));
  });
}
