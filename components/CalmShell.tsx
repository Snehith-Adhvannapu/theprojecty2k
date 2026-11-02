import Link from "next/link";
import { KheloStrip } from "@/components/Khelo";
import { Logo } from "@/components/Logo";

/** Frame for trust-critical screens: checkout, order, ticket, policies, find-ticket. No theatre. */
export function CalmShell({
  children, back, right, width = "max-w-[520px]",
}: { children: React.ReactNode; back?: { href: string; label: string }; right?: React.ReactNode; width?: string }) {
  return (
    <div className="calm min-h-dvh">
      <KheloStrip />
      <div className={`mx-auto w-full ${width} px-5 pb-12`}>
        <header className="flex items-center justify-between border-b border-line py-2">
          {back ? (
            <Link href={back.href} className="muted inline-flex min-h-11 items-center text-sm transition-colors hover:text-fg">← {back.label}</Link>
          ) : <span />}
          <Logo />
          <span className="muted text-[13px]">{right}</span>
        </header>
        {children}
      </div>
    </div>
  );
}
