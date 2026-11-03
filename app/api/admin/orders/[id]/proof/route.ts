import { z } from "zod";
import { fail, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getProof } from "@/lib/payments/manual";
import { readS3Proof } from "@/lib/proof";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireRole("admin");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", "Order not found.", 404);
    const p = await getProof(id);
    if (p.url?.startsWith("s3://")) {
      return new Response(new Uint8Array(await readS3Proof(p.url)), { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store" } });
    }
    if (p.url) return Response.redirect(p.url, 302);
    return new Response(new Uint8Array(p.data!), { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store" } });
  });
}
