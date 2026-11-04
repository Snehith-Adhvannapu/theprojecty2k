import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { facts, recipients, render, sendBroadcast, sendTest } from "@/lib/admin/broadcast";

const draft = z.object({
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(5).max(8000),
  button: z.boolean().default(false),
  audience: z.enum(["holders", "registered", "not_bought"]),
});
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("count"), audience: z.enum(["holders", "registered", "not_bought"]) }),
  draft.extend({ action: z.literal("preview") }),
  draft.extend({ action: z.literal("test") }),
  draft.extend({ action: z.literal("send") }),
]);

export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireRole("admin");
    const i = await body(req, input);
    if (i.action === "count") return ok({ count: (await recipients(i.audience)).length });
    if (i.action === "preview") {
      const m = render(i, { name: staff.name }, await facts());
      return ok({ subject: m.subject, html: m.html, count: (await recipients(i.audience)).length });
    }
    if (i.action === "test") { await sendTest(staff.id, staff.email, staff.name, i); return ok({ to: staff.email }); }
    return ok(await sendBroadcast(staff.id, i.audience, i));
  });
}
