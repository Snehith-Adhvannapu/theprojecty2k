import { z } from "zod";
import { handle } from "@/lib/api";
import { requireRole, audit } from "@/lib/auth";
import { toCsv, toXlsx } from "@/lib/admin/export";

const q = z.object({ kind: z.enum(["attendees", "checkins"]), format: z.enum(["xlsx", "csv"]) });

export async function GET(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const sp = new URL(req.url).searchParams;
    const { kind, format } = q.parse({ kind: sp.get("kind"), format: sp.get("format") });
    await audit(staff.id, "export", kind, { format });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `y2k-${kind}-${stamp}.${format}`;
    const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" };
    if (format === "csv") {
      return new Response(await toCsv(kind), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
    }
    return new Response(new Uint8Array(await toXlsx(kind)), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  });
}
