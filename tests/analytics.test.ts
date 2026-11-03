import { describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { analyticsSummary, cleanPath, readAgent, recordView, sourceOf } from "@/lib/analytics";

const phone = { ip: "203.0.113.7", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1", host: "www.projecty2k.com", country: "IN", city: "Hyderabad" };

describe("analytics", () => {
  it("never stores secret links or staff screens", () => {
    expect(cleanPath("/t/abcDEF123secretToken?x=1")).toBe("/t/*");
    expect(cleanPath("/order/5d3fe0f9-dc41-4ed1-ad61-ab7d3029d04a")).toBe("/order/*");
    expect(cleanPath("/checkout?pass=abc")).toBe("/checkout");
    expect(cleanPath("/admin")).toBeNull();
    expect(cleanPath("/scan")).toBeNull();
    expect(cleanPath("/api/orders")).toBeNull();
    expect(cleanPath("http://evil.example/")).toBeNull();
  });

  it("works out the source and ignores bots", () => {
    expect(sourceOf("https://l.instagram.com/?u=x", undefined, "www.projecty2k.com")).toBe("instagram.com");
    expect(sourceOf("https://www.projecty2k.com/", undefined, "projecty2k.com")).toBeNull();
    expect(sourceOf("https://google.com/", "Insta Story!", "x.com")).toBe("insta story");
    expect(readAgent("Googlebot/2.1")).toBeNull();
    expect(readAgent(phone.ua)).toEqual({ device: "Mobile", browser: "Safari" });
  });

  it("counts views and daily-unique visitors, and fills the funnel without keeping IPs", async () => {
    await query("DELETE FROM page_views");
    expect(await recordView({ path: "/" }, phone)).toBe(true);
    expect(await recordView({ path: "/checkout" }, phone)).toBe(true);
    expect(await recordView({ path: "/", ref: "https://l.instagram.com/" }, { ...phone, ip: "198.51.100.9" })).toBe(true);
    expect(await recordView({ path: "/" }, { ...phone, ua: "curl/8.0" })).toBe(false);
    const s = await analyticsSummary(7);
    expect(s.totals.views).toBe(3);
    expect(s.totals.visitors).toBe(2);
    expect(s.pages[0]).toMatchObject({ label: "/", views: 2, visitors: 2 });
    expect(s.sources.some((r) => r.label === "instagram.com")).toBe(true);
    expect(s.funnel[0].n).toBe(2);
    expect(s.daily).toHaveLength(7); // every day is a point, empty days are 0
    expect(s.daily.at(-1)).toMatchObject({ views: 3, visitors: 2 });
    expect((await analyticsSummary(1)).daily).toHaveLength(24); // hourly for the last 24 hours
    expect((await analyticsSummary(30)).daily).toHaveLength(30);
    const raw = JSON.stringify(await query("SELECT * FROM page_views"));
    expect(raw).not.toContain("203.0.113.7");
  });
});
