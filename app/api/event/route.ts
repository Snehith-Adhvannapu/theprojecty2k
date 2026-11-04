import { handle, ok } from "@/lib/api";
import { cachedPasses, publicEvent, recentPulse } from "@/lib/event-public";

export async function GET() {
  return handle(async () =>
    ok(
      { event: publicEvent(), passes: await cachedPasses(), pulse: await recentPulse().catch(() => null) },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } },
    ),
  );
}
