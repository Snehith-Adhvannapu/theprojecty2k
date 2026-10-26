import Link from "next/link";
import { CalmShell } from "@/components/CalmShell";

export default function NotFound() {
  return (
    <CalmShell back={{ href: "/", label: "Home" }}>
      <h1 className="mt-7 text-[28px] leading-[1.15]">We can&apos;t find that page.</h1>
      <p className="muted mt-2">If you were looking for your ticket, use the link in your email, or find it with your email or phone.</p>
      <Link href="/find-ticket" className="btn btn-quiet btn-calm mt-5">Find my ticket</Link>
    </CalmShell>
  );
}
