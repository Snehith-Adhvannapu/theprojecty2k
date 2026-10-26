import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { sendFindMyTicket } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`find:${clientIp(req)}`, 5, 60_000)) {
      return fail("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);
    }
    const { contact } = await body(req, z.object({ contact: z.string().trim().min(5).max(120) }));
    const email = contact.includes("@") ? normalizeEmail(contact) : null;
    const phone = email ? null : normalizePhone(contact);
    if (!email && !phone) return fail("VALIDATION", "Enter the email or mobile number you used to buy.", 400);
    await sendFindMyTicket(email, phone);
    // identical answer whether or not anything matched
    return ok({ message: "If we found a ticket, we've emailed the link to the address on the order." });
  });
}
