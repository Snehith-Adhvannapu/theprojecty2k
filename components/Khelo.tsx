// Khelo, our ticketing and community partner. Three placements: a slim strip on every public screen,
// the "side quest" card (gamers only, shown while a buyer waits and on the ticket), and a partner block on the landing page.
import Image from "next/image";
import { eventConfig as e } from "@/config/event";

const { khelo } = e;

function Mark({ size = 22 }: { size?: number }) {
  return <Image src={khelo.logo} alt="" width={size} height={size} className="rounded-[5px]" />;
}

export function KheloStrip() {
  return (
    <div className="border-b border-line bg-band">
      <a href={khelo.url} rel="noopener" className="wrap flex min-h-11 items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-muted">
        <span className="inline-flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-crimson" aria-hidden="true" />Ticketing powered by</span>
        <span className="inline-flex items-center gap-2 font-extrabold tracking-[0.24em] text-fg"><Mark size={20} />KHEL-O</span>
      </a>
    </div>
  );
}

/** The ask: gamers join the Khelo WhatsApp community. `lead` changes the first line of the copy. */
export function KheloQuest({ lead = "", className = "" }: { lead?: string; className?: string }) {
  return (
    <aside className={`quest ${className}`} aria-label="Join the Khelo gaming community on WhatsApp">
      <div className="min-w-0 flex-1 p-5">
        <p className="eyebrow !text-[11px]">Side quest <span className="muted">· Gamers only</span></p>
        <p className="quest-h mt-2.5">Gamer?<br />Join the squad.</p>
        <p className="muted mt-3 text-[15px] leading-relaxed">
          {lead ? `${lead}we` : "We"} host free gaming tournaments. Join the Khelo WhatsApp community for gamers and sports lovers, see photos from the last one, and find people to play with.
        </p>
        <a href={khelo.communityUrl} target="_blank" rel="noopener" className="btn btn-primary btn-calm btn-block mt-4">Join on WhatsApp <span aria-hidden="true">→</span></a>
        <p className="muted mt-3 text-[13px]">Only for gamers. Not into gaming? Skip this, nothing else changes.</p>
      </div>
      <div className="quest-tear" aria-hidden="true" />
      <div className="quest-side" aria-hidden="true"><Mark size={22} /><span>KHEL-O</span></div>
    </aside>
  );
}

export function KheloPartner() {
  return (
    <section className="wrap pb-14" aria-label="Khelo, our partner">
      <div className="border border-line bg-band p-6 md:flex md:items-center md:justify-between md:gap-10 md:p-8">
        <div className="max-w-[60ch]">
          <p className="eyebrow">Ticketing &amp; community partner</p>
          <p className="mt-3 flex items-center gap-3 font-display text-[54px] leading-none tracking-[0.06em]"><Mark size={44} />KHEL-O</p>
          <p className="muted mt-3">Book gaming cafés, snooker and bowling in Hyderabad. Khelo hosts free gaming tournaments and runs a WhatsApp community for gamers and sports lovers.</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 md:mt-0 md:w-[300px] md:shrink-0">
          <a href={khelo.communityUrl} target="_blank" rel="noopener" className="btn btn-primary min-h-12 justify-center">Join the WhatsApp community</a>
          <a href={khelo.url} rel="noopener" className="btn min-h-12 justify-center">Visit khel-o.com <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  );
}
