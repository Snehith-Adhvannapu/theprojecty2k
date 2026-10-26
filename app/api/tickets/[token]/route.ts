import { fail, handle, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { ticketByToken } from "@/lib/tickets";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const t = await ticketByToken({ query }, token);
    if (!t) return fail("NOT_FOUND", "Ticket not found.", 404);
    return ok(
      { shortCode: t.short_code, admits: t.admits, status: t.status, name: t.holder_name, passName: t.pass_name },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
