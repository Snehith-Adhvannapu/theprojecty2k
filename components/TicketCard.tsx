import Image from "next/image";
import { eventConfig as e } from "@/config/event";
import { TicketQR } from "@/components/TicketQR";
import { Tip } from "@/components/Tip";

export interface TicketCardData {
  token: string; shortCode: string; admits: number; passName: string; holderName: string;
  status?: "valid" | "used" | "revoked"; usedAtLabel?: string | null;
}

export function TicketCard({ t, delay = 0 }: { t: TicketCardData; delay?: number }) {
  const dead = t.status === "revoked" || t.status === "used";
  return (
    <section aria-label="Your ticket" className={`card slide-up overflow-hidden ${dead ? "" : "elite"}`} style={{ "--i": delay } as React.CSSProperties}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <Image src="/images/y2k26-logo-sm.webp" alt="Project Y2K26" width={240} height={185} style={{ height: 56, width: "auto" }} />
          <p className="text-right text-xs uppercase tracking-[0.3em] text-crimson">15 Nov 2026</p>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="muted text-[13px]">{t.passName}</p>
            <p className="mt-0.5 truncate text-lg font-semibold">{t.holderName}</p>
          </div>
          <p className="shrink-0 whitespace-nowrap text-right font-display leading-[0.9] tracking-[0.02em]"><span className="flex items-center justify-end gap-1.5 text-[13px] tracking-[0.2em] text-muted">ADMITS<Tip text="How many people this one ticket lets in." /></span><span className="text-[64px]">{t.admits}</span></p>
        </div>
        <p className="muted mt-3 text-[13px]">{[e.venue.name, e.venue.address].filter(Boolean).join(", ")} · Doors {e.doorsOpen}</p>
        {e.venue.mapUrl && <a href={e.venue.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-calm btn-quiet mt-3 min-h-11 w-full">Get directions (Google Maps)</a>}
      </div>
      <div className="relative flex flex-col items-center gap-3.5 border-t border-dashed border-line-strong p-5">
        <div className={dead ? "opacity-25" : ""}><TicketQR token={t.token} /></div>
        {t.status === "revoked" && <Banner>Cancelled / refunded. This ticket will not be accepted.</Banner>}
        {t.status === "used" && <Banner>Already used{t.usedAtLabel ? ` at ${t.usedAtLabel}` : ""}.</Banner>}
        <div className="text-center">
          <p className="label flex items-center justify-center gap-1.5">Short code<Tip text="If the QR won't scan, read this code to the volunteer at the door. Keep your ticket private: each QR works only once." /></p>
          <p className="tnum mt-1 text-[28px] font-semibold tracking-[0.18em]">{t.shortCode}</p>
        </div>
      </div>
    </section>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <p role="status" className="rounded-sm border border-danger px-3 py-2 text-center text-sm font-semibold">{children}</p>;
}
