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
      <a href={khelo.url} target="_blank" rel="noopener noreferrer" className="wrap flex min-h-12 items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
        <span className="inline-flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-crimson" aria-hidden="true" />Ticketing powered by</span>
        <span className="inline-flex items-center gap-2 font-extrabold tracking-[0.24em] text-fg"><Mark size={20} />KHEL-O</span>
      </a>
    </div>
  );
}

/** The ask: gamers join the Khelo community. Short on purpose. */
export function KheloQuest({ className = "" }: { className?: string }) {
  return (
    <aside className={`quest ${className}`} aria-label="Join the khel-o gamers community">
      <div className="min-w-0 flex-1 p-5">
        <p className="eyebrow !text-xs">Gamers only</p>
        <p className="quest-h mt-2.5">Gamers get<br />in first.</p>
        <p className="muted mt-3 text-[15px] leading-relaxed">khel-o finds you Hyderabad’s best gaming cafés and snooker hubs, and hosts the tournaments. The inner circle gets the invites first. Be in it.</p>
        <a href={khelo.communityUrl} target="_blank" rel="noopener" className="btn btn-primary btn-calm btn-block mt-4"><span className="text-center">Join the gamers community</span> <span aria-hidden="true">→</span></a>
      </div>
      <div className="quest-tear" aria-hidden="true" />
      <div className="quest-side" aria-hidden="true"><Mark size={22} /><span>KHEL-O</span></div>
    </aside>
  );
}

export function KheloPartner() {
  return (
    <section className="wrap pb-14" aria-label="khel-o, our partner">
      <div className="border border-line bg-band p-6 md:flex md:items-center md:justify-between md:gap-10 md:p-8">
        <div className="max-w-[60ch]">
          <p className="eyebrow">Ticketing &amp; community partner</p>
          <p className="mt-3 flex items-center gap-3 font-display text-[54px] leading-none tracking-[0.06em]"><Mark size={44} />KHEL-O</p>
          <p className="muted mt-3">khel-o finds you Hyderabad’s best gaming cafés and snooker hubs, and hosts the tournaments. The inner circle gets the invites first. Be in it.</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 md:mt-0 md:w-[300px] md:shrink-0">
          <a href={khelo.communityUrl} target="_blank" rel="noopener" className="btn btn-primary btn-calm min-h-12 justify-center"><span className="text-center">Join the gamers community</span></a>
          <a href={khelo.url} rel="noopener" className="btn btn-calm min-h-12 justify-center">Visit khel-o.com <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  );
}
