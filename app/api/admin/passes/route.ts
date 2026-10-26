import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { listPasses, upsertPass } from "@/lib/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).default(""),
  pricePaise: z.number().int().min(0).max(10_000_000),
  feePaise: z.number().int().min(0).max(1_000_000).default(0),
  totalQty: z.number().int().min(0).max(100_000),
  admits: z.number().int().min(1).max(10),
  active: z.boolean(),
  sort: z.number().int().min(0).max(100).default(0),
  salesStart: z.string().datetime({ offset: true }).nullable().default(null),
  salesEnd: z.string().datetime({ offset: true }).nullable().default(null),
});

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await listPasses(), { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    return ok({ id: await upsertPass(staff.id, await body(req, schema)) });
  });
}
