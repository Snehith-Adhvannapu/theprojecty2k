import { clientIp, rateLimit } from "@/lib/ratelimit";
import { recordView, trackInput } from "@/lib/analytics";

// Always answers 204: a visitor's page must never notice or wait on analytics.
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`track:${ip}`, 90, 60_000)) return new Response(null, { status: 204 });
    const parsed = trackInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(null, { status: 204 });
    await recordView(parsed.data, {
      ip,
      ua: req.headers.get("user-agent") ?? "",
      host: req.headers.get("host") ?? "",
      country: req.headers.get("x-vercel-ip-country"),
      city: req.headers.get("x-vercel-ip-city"),
    });
  } catch { /* analytics is best effort */ }
  return new Response(null, { status: 204 });
}
