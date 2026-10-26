import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { checkIn } from "@/lib/checkin";

const schema = z
  .object({
    token: z.string().min(8).max(200).optional(),
    shortCode: z.string().min(4).max(20).optional(),
    clientEventId: z.string().uuid().optional(),
    method: z.enum(["qr", "manual"]),
  })
  .refine((v) => v.token || v.shortCode, "Scan a QR code or enter a short code");

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("volunteer");
    const d = await body(req, schema);
    const result = await checkIn({ ...d, staffId: staff.id });
    return ok(result, { headers: { "Cache-Control": "no-store" } });
  });
}
