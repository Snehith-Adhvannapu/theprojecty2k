import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminApp } from "@/components/admin/AdminApp";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/admin");
  if (staff.role !== "admin") redirect("/scan"); // server-side: volunteers never get the admin shell
  return <AdminApp name={staff.name} />;
}
