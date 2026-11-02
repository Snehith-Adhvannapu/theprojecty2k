import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminApp } from "@/components/admin/AdminApp";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; order?: string }> }) {
  const sp = await searchParams;
  const order = /^[0-9a-f-]{36}$/i.test(sp.order ?? "") ? sp.order : undefined;
  const tab = sp.tab === "payments" ? "Payments" : undefined;
  const staff = await getStaff();
  if (!staff) {
    const back = `/admin${tab ? `?tab=payments${order ? `&order=${order}` : ""}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  if (staff.role !== "admin") redirect("/scan"); // server-side: volunteers never get the admin shell
  return <AdminApp name={staff.name} initialTab={tab} focusOrder={order} />;
}
