import { handle, ok } from "@/lib/api";
import { cachedPasses, publicEvent } from "@/lib/event-public";

export async function GET() {
  return handle(async () =>
    ok(
      { event: publicEvent(), passes: await cachedPasses() },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } },
    ),
  );
}
