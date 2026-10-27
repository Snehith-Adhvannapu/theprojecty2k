import { fail, handle } from "@/lib/api";
import { query } from "@/lib/db";
import { ticketByToken } from "@/lib/tickets";
import { ticketPdf } from "@/lib/tickets/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return fail("NOT_FOUND", "Ticket not found.", 404);
    const t = await ticketByToken({ query }, token);
    if (!t || t.status === "revoked") return fail("NOT_FOUND", "Ticket not found.", 404);
    const bytes = await ticketPdf({ token, shortCode: t.short_code, admits: t.admits, passName: t.pass_name, holderName: t.holder_name });
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${t.short_code}.pdf"`, "Cache-Control": "private, no-store" },
    });
  });
}
