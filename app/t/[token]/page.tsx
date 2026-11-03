import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalmShell } from "@/components/CalmShell";
import { TicketCard } from "@/components/TicketCard";
import { TicketActions } from "@/components/TicketActions";
import { WelcomeActions } from "@/components/WelcomeActions";
import { eventConfig as e } from "@/config/event";
import { query } from "@/lib/db";
import { ticketByToken } from "@/lib/tickets";
import { whatsappLink } from "@/lib/contact";
import { formatTimeIST } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket", robots: { index: false, follow: false } };

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await ticketByToken({ query }, token);
  if (!t) notFound();

  return (
    <CalmShell right="Ticket">
      <div className="mt-5 flex flex-col gap-4">
        {t.status !== "revoked" && (
          <div className="welcome-rise" style={{ "--i": 0 } as React.CSSProperties}>
            <p className="inline-flex w-fit items-center gap-2 rounded-sm border border-line-strong px-3 py-1.5 text-[13px]">
              <span aria-hidden="true">✓</span> {t.source === "comp" ? "Complimentary ticket" : "Payment confirmed"}
            </p>
            <h1 className="mt-3 text-[30px] leading-[1.1]">You&apos;re on the <em>list.</em></h1>
            <span className="rule-draw mt-3 block h-px w-24 bg-crimson" aria-hidden="true" />
          </div>
        )}
        <TicketCard
          t={{
            token, shortCode: t.short_code, admits: t.admits, passName: t.pass_name, holderName: t.holder_name,
            status: t.status, usedAtLabel: t.used_at ? formatTimeIST(t.used_at) : null,
          }}
        />
        <p className="muted text-center text-sm">
          Screenshot this page. If the QR won&apos;t scan, read your short code to the volunteer. Your name and ID will be checked at the door.
        </p>
        <TicketActions token={token} whatsapp={whatsappLink("Hi, I need help with my Project Y2K ticket")} />
        {t.status === "valid" && <WelcomeActions />}
        <p className="muted flex justify-between gap-3 pt-2 text-xs">
          <span>{e.dateLabel}</span>
        </p>
      </div>
    </CalmShell>
  );
}
