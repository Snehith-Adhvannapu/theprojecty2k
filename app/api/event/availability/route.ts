import { handle, ok } from "@/lib/api";
import { cachedPasses } from "@/lib/event-public";

export async function GET() {
  return handle(async () => {
    const passes = await cachedPasses();
    return ok(
      passes.map((p) => ({ id: p.id, available: p.available, onSale: p.onSale })),
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } },
    );
  });
}
