import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { listContacts, STATUS_FILTERS } from "@/lib/admin/contacts";

const q = z.object({ q: z.string().max(80).default(""), status: z.enum(STATUS_FILTERS).default("all"), unique: z.enum(["0", "1"]).default("1") });

export async function GET(req: Request) {
  return handle(async () => {
    await requireRole("admin");
    const sp = new URL(req.url).searchParams;
    const p = q.parse({ q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, unique: sp.get("unique") ?? undefined });
    return ok(await listContacts({ q: p.q, status: p.status, unique: p.unique === "1" }), { headers: { "Cache-Control": "no-store" } });
  });
}
