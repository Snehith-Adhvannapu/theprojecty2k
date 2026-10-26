import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalmShell } from "@/components/CalmShell";
import { LoginForm } from "@/components/LoginForm";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getStaff();
  if (s) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : s.role === "admin" ? "/admin" : "/scan");
  return (
    <CalmShell back={{ href: "/", label: "Home" }}>
      <h1 className="mt-7 text-[28px] leading-[1.15]">Staff sign in</h1>
      <p className="muted mt-2">For volunteers and organisers. Each person has their own account.</p>
      <LoginForm next={next} />
    </CalmShell>
  );
}
