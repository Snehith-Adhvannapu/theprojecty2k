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

export const metadata: Metadata = {
  title: { default: `${eventConfig.name} · ${eventConfig.dateLabel}`, template: `%s · ${eventConfig.name}` },
  description: eventConfig.description,
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${cormorant.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
