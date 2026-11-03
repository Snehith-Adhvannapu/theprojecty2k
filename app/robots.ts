import type { MetadataRoute } from "next";
import { SITE_URL, isIndexableHost } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Test hosts (aws.*, localhost) ask crawlers to stay away entirely.
  if (!isIndexableHost()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/scan", "/order/", "/t/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
