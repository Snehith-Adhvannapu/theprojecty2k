import Link from "next/link";
import { eventConfig as e } from "@/config/event";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-band">
      <div className="wrap flex flex-wrap justify-between gap-x-16 gap-y-8 py-12">
        <div className="min-w-60 flex-1">
          <Logo size={84} className="-ml-1" />
          <p className="muted mt-3 text-sm leading-relaxed">
            WhatsApp {e.organiser.whatsapp}
            <br />
            {e.organiser.email}
            <br />
            {e.organiser.instagram}
          </p>
        </div>
        <nav aria-label="Policies" className="flex min-w-48 flex-1 flex-col">
          {[
            ["/terms", "Terms & conditions"],
            ["/privacy", "Privacy policy"],
            ["/contact", "Contact"],
            ["/find-ticket", "Find my ticket"],
            ["/login", "Staff login"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="muted inline-flex min-h-11 items-center text-sm transition-colors hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
        <div className="muted min-w-48 flex-1 text-[13px]">
          <p>© 2026 Project Y2K · {e.organiser.name}</p>
        </div>
      </div>
    </footer>
  );
}
