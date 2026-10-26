import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { Scanner } from "@/components/Scanner";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Scanner", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1, maximumScale: 1 };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/scan");
  return <Scanner name={staff.name} isAdmin={staff.role === "admin"} />;
}
