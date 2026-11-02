import Link from "next/link";
import { eventConfig as e } from "@/config/event";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-band">
      <div className="wrap flex flex-wrap justify-between gap-x-16 gap-y-8 py-12">
        <div className="min-w-60 flex-1">
          <p className="font-display text-[32px] leading-none tracking-[0.04em]">Project Y2K</p>
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
          ].map(([href, label]) => (
            <Link key={href} href={href} className="muted inline-flex min-h-11 items-center text-sm transition-colors hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
        <div className="muted min-w-48 flex-1 text-[13px]">
          <p>© 2026 Project Y2K · {e.organiser.name}</p>
          <p className="mt-2">
            Ticketing powered by{" "}
            <a href={e.khelo.url} className="border-b border-blood text-fg" rel="noopener">
              {e.khelo.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
