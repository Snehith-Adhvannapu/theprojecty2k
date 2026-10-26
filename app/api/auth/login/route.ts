import { z } from "zod";
import { body, fail, handle, ok } from "@/lib/api";
import { login, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
      return fail("RATE_LIMITED", "Too many attempts. Please wait a minute.", 429);
    }
    const { email, password } = await body(req, z.object({ email: z.string().trim().max(120), password: z.string().min(1).max(200) }));
    const { token, staff } = await login(email, password);
    await setSessionCookie(token);
    return ok({ name: staff.name, role: staff.role });
  });
}
