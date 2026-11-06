import { SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_URL, isIndexableHost } from "@/lib/seo";
import { Track } from "@/components/Track";
import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Cormorant_Garamond, Manrope } from "next/font/google";
import { eventConfig } from "@/config/event";
import "./globals.css";

// Self-hosted at build by next/font, subset, display: swap. Variable names match design/tokens.css.
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas", display: "swap" });
const cormorant = Cormorant_Garamond({
  weight: "500", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-cormorant", display: "swap",
});
const manrope = Manrope({ weight: ["400", "500", "600", "800"], subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// Link-preview text (WhatsApp, Instagram, iMessage). Same on every page so a shared link always looks the same.
const SOCIAL_TITLE = "Project Y2K presents The Matrix: tickets on sale";
const SOCIAL_DESC = "Party coming soon. Get your tickets for Hyderabad's first theatre rave: 15 November 2026.";

const OG_IMAGE = { url: "/images/og-tickets-v2.jpg", width: 1200, height: 630, alt: "Poster: Project Y2K presents The Matrix, Hyderabad's first theatre rave, 15 November 2026" };

export const metadata: Metadata = {
  // Always the real domain, so a test host (aws.*) never advertises itself as the canonical address.
  metadataBase: new URL(SITE_URL),
  title: { default: SEO_TITLE, template: `%s · ${eventConfig.name}` },
  description: SEO_DESCRIPTION,
  applicationName: eventConfig.name,
  keywords: SEO_KEYWORDS,
  category: "events",
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: eventConfig.name, locale: "en_IN", title: SOCIAL_TITLE, description: SOCIAL_DESC, url: "/", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SOCIAL_TITLE, description: SOCIAL_DESC, images: [OG_IMAGE.url] },
  robots: isIndexableHost()
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
    : { index: false, follow: false },
  formatDetection: { telephone: false },
  // Google Search Console HTML-tag verification, only if you choose that method (DNS verification needs nothing here).
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN"className={`${bebas.variable} ${cormorant.variable} ${manrope.variable}`}>
      <body>{children}<Track /></body>
    </html>
  );
}
