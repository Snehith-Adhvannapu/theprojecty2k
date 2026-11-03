import { z } from "zod";
import { handle } from "@/lib/api";
import { requireRole, audit } from "@/lib/auth";
import { toCsv, toXlsx, type ExportOpts } from "@/lib/admin/export";
import { STATUS_FILTERS } from "@/lib/admin/contacts";

const q = z.object({ kind: z.enum(["attendees", "checkins", "contacts", "refunds"]), format: z.enum(["xlsx", "csv"]), status: z.enum(STATUS_FILTERS).default("all"), unique: z.enum(["0", "1"]).default("1") });

export async function GET(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const sp = new URL(req.url).searchParams;
    const p = q.parse({ kind: sp.get("kind"), format: sp.get("format"), status: sp.get("status") ?? undefined, unique: sp.get("unique") ?? undefined });
    const { kind, format } = p;
    const opts: ExportOpts = { status: p.status, unique: p.unique === "1" };
    await audit(staff.id, "export", kind, { format });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `y2k-${kind}-${stamp}.${format}`;
    const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" };
    if (format === "csv") {
      return new Response(await toCsv(kind, opts), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
    }
    return new Response(new Uint8Array(await toXlsx(kind, opts)), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  });
}
