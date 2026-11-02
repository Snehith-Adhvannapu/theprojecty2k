import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { allGuests } from "@/lib/admin";
import { getStaff , isAdminRole } from "@/lib/auth";
import { eventConfig as e } from "@/config/event";
import { formatFullIST } from "@/lib/time";

export const metadata: Metadata = { title: "Guest list", robots: { index: false } };
export const dynamic = "force-dynamic";

// A-Z paper backup for the door. Admin only. Print at T-24h and T-2h.
export default async function PrintList() {
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/admin/print");
  if (!isAdminRole(staff.role)) redirect("/scan");
  const guests = (await allGuests()).filter((g) => g.status !== "revoked");
  return (
    <div className="calm mx-auto max-w-[900px] p-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <a href="/admin" className="muted text-sm">← Admin</a>
        <PrintButton />
      </div>
      <h1 className="text-xl">{e.name} · Guest list</h1>
      <p className="muted text-sm">Printed {formatFullIST(new Date())} IST · {guests.length} tickets · {guests.reduce((n, g) => n + g.admits, 0)} people</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead><tr className="text-left"><th className="border-b border-line py-2">☐</th><th className="border-b border-line py-2">Name</th><th className="border-b border-line py-2">Code</th><th className="border-b border-line py-2">Pass</th><th className="border-b border-line py-2">Admits</th><th className="border-b border-line py-2">Phone</th><th className="border-b border-line py-2">Status</th></tr></thead>
        <tbody>
          {guests.map((g) => (
            <tr key={g.id}>
              <td className="border-b border-line py-1.5">☐</td>
              <td className="border-b border-line py-1.5">{g.name}</td>
              <td className="tnum border-b border-line py-1.5">{g.shortCode}</td>
              <td className="border-b border-line py-1.5">{g.passName}</td>
              <td className="border-b border-line py-1.5">{g.admits}</td>
              <td className="tnum border-b border-line py-1.5">…{g.phone.slice(-4)}</td>
              <td className="border-b border-line py-1.5">{g.status === "used" ? "Used" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
