import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { initiatePayment } from "@/lib/payments";

export async function POST(req: Request) {
  return handle(async () => {
    const { orderId } = await body(req, z.object({ orderId: z.string().uuid() }));
    return ok(await initiatePayment(orderId));
  });
}
