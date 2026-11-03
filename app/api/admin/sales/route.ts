import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getSales, setSalesPaused } from "@/lib/sales";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    return ok(await getSales(), { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const { paused } = await body(req, z.object({ paused: z.boolean() }));
    return ok(await setSalesPaused(staff.id, paused));
  });
}
