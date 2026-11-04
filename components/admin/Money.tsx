"use client";
// The money, in plain words. Four numbers an organiser actually asks about, each with one sentence saying what it is.
import { paise } from "@/lib/normalize";

export interface MoneyData {
  gross: number; refunds: number; owed: number; inBank: number; bookingFees: number; todayPaise: number; todayPasses: number;
}

function Tile({ label, value, note, tone, children }: { label: string; value: string; note: string; tone?: "alert"; children?: React.ReactNode }) {
  return (
    <div className={`card-plain flex flex-col p-5 ${tone === "alert" ? "border-blood" : ""}`}>
      <p className="label">{label}</p>
      <p className="tnum mt-2 text-[32px] font-semibold leading-none">{value}</p>
      <p className="muted mt-3 text-[15px] leading-snug">{note}</p>
      {children}
    </div>
  );
}

export function Money({ m, sold, go }: { m: MoneyData; sold: number; go: (tab: "Refunds") => void }) {
  return (
    <section data-tour="ov-money" aria-label="Money" className="flex flex-col gap-3">
      <div className="card flex flex-wrap items-end justify-between gap-x-10 gap-y-5 p-6">
        <div>
          <p className="label">Earned from tickets</p>
          <p className="tnum mt-2 text-[44px] font-semibold leading-none">{paise(m.gross)}</p>
          <p className="muted mt-3 text-[15px]">From {sold} {sold === 1 ? "ticket" : "tickets"}, after you approved the payments.{m.bookingFees > 0 && <> Includes {paise(m.bookingFees)} of booking fees.</>}</p>
        </div>
        <div className="border-line sm:border-l sm:pl-8">
          <p className="label">Today</p>
          <p className="tnum mt-2 text-[28px] font-semibold leading-none">{paise(m.todayPaise)}</p>
          <p className="muted mt-2 text-[15px]">{m.todayPasses} {m.todayPasses === 1 ? "pass" : "passes"} sold since midnight</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Sent back to buyers" value={paise(m.refunds)} note="Refunds you have already paid out from your UPI app." />
        <Tile label="Waiting to send back" value={paise(m.owed)} tone={m.owed > 0 ? "alert" : undefined}
          note={m.owed > 0 ? "Buyers who paid but will not get a ticket. Send this money back." : "Nothing to send back right now."}>
          {m.owed > 0 && <button className="btn btn-primary btn-calm mt-4 min-h-11 self-start px-5 text-sm" onClick={() => go("Refunds")}>Send refunds</button>}
        </Tile>
        <Tile label="Should be in your bank" value={paise(m.inBank)} note="Earned, plus the money waiting to go back. Compare this with your bank statement." />
      </div>
    </section>
  );
}
