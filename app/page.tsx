import Link from "next/link";
import { eventConfig as e } from "@/config/event";
import { Logo } from "@/components/Logo";
import { PassPicker } from "@/components/PassPicker";
import { SiteFooter } from "@/components/SiteFooter";

// Static: built at deploy, zero DB calls on render. Availability arrives via PassPicker.
export const dynamic = "force-static";

const faqs: [string, string][] = [
  ["How do I get my ticket?", "It appears on screen the moment your payment is confirmed, and a copy goes to your email."],
  [
    "I paid but don't see my ticket.",
    `Wait two minutes and refresh; confirmation can take a moment. Still nothing? WhatsApp ${e.organiser.whatsapp} with your phone number and payment screenshot. If you were charged, you get a ticket or a refund.`,
  ],
  ["I lost my ticket or the email.", "Use “Find my ticket” on this site, or we look you up at the door with your name, phone number and ID."],
  ["Who can come?", `${e.ageLimit}. Bring a valid government photo ID.`],
  ["Is my ticket transferable?", `${e.policy.transferable}. Each QR works once. Whoever's code is scanned first gets in, so don't post it publicly.`],
  ["What about refunds?", `${e.policy.refundPolicy}. Full policy linked in the footer.`],
];

const photos = [
  { label: "Photo 1 · wide crowd shot", cls: "basis-[420px] flex-[2] aspect-[3/2]" },
  { label: "Photo 2 · portrait, flash", cls: "basis-[240px] flex-1 aspect-[3/4]" },
  { label: "Photo 3 · portrait", cls: "basis-[240px] flex-1 aspect-[3/4]" },
  { label: "Photo 4 · detail", cls: "basis-[240px] flex-1 aspect-square" },
  { label: "Photo 5 · dance floor", cls: "basis-[240px] flex-1 aspect-square" },
];

export default function Home() {
  return (
    <main id="top" className="overflow-x-clip">
      <header className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-2">
        <Logo />
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-7">
          <a href="#last" className="muted inline-flex min-h-11 items-center text-xs uppercase tracking-[0.25em] transition-colors hover:text-fg">Last time</a>
          <a href="#faq" className="muted inline-flex min-h-11 items-center text-xs uppercase tracking-[0.25em] transition-colors hover:text-fg">FAQ</a>
          <a href="#passes" className="btn min-h-11 px-5 text-xs">Get passes</a>
        </nav>
      </header>

      {/* HERO: the one place with theatre */}
      <section className="relative overflow-hidden">
        <div className="wrap flex flex-wrap items-center gap-x-14 gap-y-10 pt-14 pb-16 md:pb-20">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="in eyebrow" style={{ "--i": 0 } as React.CSSProperties}>✦ {e.dateLabel}</p>
            <h1 className="mt-6 font-normal">
              <span className="in hero-project" style={{ "--i": 1 } as React.CSSProperties}>Project</span>
              <span className="in block" style={{ "--i": 2 } as React.CSSProperties}>
                <span className="hero-y2k">Y2K</span>
              </span>
            </h1>
            <p className="in muted mt-8 max-w-[38ch] text-lg" style={{ "--i": 3 } as React.CSSProperties}>{e.description}</p>
            <dl className="in mt-8 flex flex-wrap gap-x-10 gap-y-5" style={{ "--i": 4 } as React.CSSProperties}>
              {[
                ["Date", "15.11.2026"],
                ["Venue", e.venue.name],
                ["Doors", e.doorsOpen],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="mt-1">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="in mt-9 flex flex-wrap items-center gap-x-7 gap-y-2" style={{ "--i": 5 } as React.CSSProperties}>
              <a href="#passes" className="btn btn-primary min-h-12 px-7">Get passes <span className="arrow" aria-hidden="true">→</span></a>
              <a href="#last" className="inline-flex min-h-12 items-center text-[13px] uppercase tracking-[0.25em]">See last time</a>
            </div>
            <p className="in muted mt-5 text-[13px]" style={{ "--i": 6 } as React.CSSProperties}>
              Instant digital ticket · Secure checkout · Refund policy in plain English
            </p>
          </div>
          <div className="in relative mx-auto aspect-[4/5] w-full max-w-[460px] flex-[1_1_320px]" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="hero-glow absolute -inset-6 -z-10" style={{ background: "var(--glow)", opacity: 0.35 }} aria-hidden="true" />
            <div className="ph h-full">
              <p>Hero photo · best crowd shot, flash on, from last time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker: purposeful motion, pauses on hover, off for reduced motion */}
      <div className="band overflow-hidden py-3" aria-hidden="true">
        <div className="ticker font-display text-2xl tracking-[0.12em] text-muted">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center gap-8 pr-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="flex items-center gap-8 whitespace-nowrap">
                  <span>Project Y2K</span><span className="text-crimson">✦</span><span>{e.dateLabel}</span><span className="text-crimson">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section aria-label="Why you can trust this" className="band border-t-0">
        <div className="wrap flex flex-wrap justify-between gap-x-12 gap-y-5 py-7 text-sm">
          <p><span className="text-crimson">01</span>&nbsp; Ticket appears the moment payment is confirmed</p>
          <p><span className="text-crimson">02</span>&nbsp; Fees shown before you pay. No surprises</p>
          <p><span className="text-crimson">03</span>&nbsp; Real people on WhatsApp: {e.organiser.whatsapp}</p>
        </div>
      </section>

      {/* LAST TIME */}
      <section id="last" className="wrap section reveal">
        <p className="eyebrow">The last one</p>
        <h2 className="h2 mt-4">Last time, <em>as it happened.</em></h2>
        <div className="mt-10 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.label} className={`ph min-w-0 ${p.cls}`}><p>{p.label}</p></div>
          ))}
          <div className="ph aspect-video min-w-0 flex-[2] basis-[420px]" style={{ borderColor: "var(--blood)" }}>
            <p style={{ color: "var(--crimson)" }}>Clip · 10 to 15 sec, muted, loads when in view</p>
          </div>
        </div>
        <p className="muted mt-6 max-w-[60ch]">[NUMBER] people came. [Use real numbers only. Delete this line if you can&apos;t back it up.]</p>
        <p className="label mt-14">From the people who came</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {["IG story screenshot, with permission", "IG story screenshot, with permission", "DM or comment, with permission"].map((t, i) => (
            <div key={i} className="ph aspect-[9/16] min-w-0 flex-[0_1_180px]" style={{ background: "var(--card)" }}>
              <p className="normal-case tracking-normal">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DETAILS */}
      <section aria-label="Event details" className="band">
        <div className="wrap flex flex-wrap gap-x-12 gap-y-7 py-10">
          {[
            ["Date", e.dateLabel, "flex-[1_1_160px]"],
            ["Doors", e.doorsOpen, "flex-[1_1_160px]"],
            ["Music", `${e.musicFrom} to ${e.musicUntil}`, "flex-[1_1_160px]"],
            ["Venue", `${e.venue.name}, ${e.venue.address}`, "flex-[2_1_240px]"],
            ["Age", e.ageLimit, "flex-[1_1_160px]"],
            ["Dress", e.dressCode, "flex-[1_1_160px]"],
          ].map(([k, v, c]) => (
            <div key={k} className={c}>
              <p className="label">{k}</p>
              <p className="mt-2 font-serif text-[28px] leading-[1.1]">{v}</p>
            </div>
          ))}
          {e.venue.mapUrl && (
            <a href={e.venue.mapUrl} className="btn btn-quiet self-end">Open map</a>
          )}
        </div>
      </section>

      {/* PASSES */}
      <section id="passes" className="wrap section scroll-mt-4">
        <p className="eyebrow">Passes</p>
        <h2 className="h2 mt-4">Pick your <em>pass.</em></h2>
        <p className="muted mt-4 max-w-[56ch]">Any fee is shown before you pay. Your ticket appears on screen as soon as payment is confirmed.</p>
        <PassPicker />
        <ol className="muted mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          <li><span className="text-crimson">1</span>&nbsp; Pay securely</li>
          <li><span className="text-crimson">2</span>&nbsp; Ticket appears on screen once payment is confirmed</li>
          <li><span className="text-crimson">3</span>&nbsp; A copy lands in your email</li>
        </ol>
      </section>

      {/* ABOUT */}
      <section className="band border-b-0">
        <div className="wrap section flex flex-wrap items-center gap-x-16 gap-y-10 reveal">
          <div className="ph aspect-[4/5] w-full max-w-[440px] flex-[1_1_300px]"><p>Organisers · real faces, real names</p></div>
          <div className="flex-[1_1_360px]">
            <p className="eyebrow">About</p>
            <h2 className="h2 mt-4">Who&apos;s <em>behind it.</em></h2>
            <p className="muted mt-6 max-w-[52ch]">[2 TO 4 TRUE SENTENCES: who you are, the last party, why you&apos;re doing it again.]</p>
            <p className="muted mt-4 max-w-[52ch]">{e.organiser.name} · WhatsApp {e.organiser.whatsapp} · {e.organiser.instagram}</p>
            <p className="mt-6 text-sm">
              Ticketing powered by <a href={e.khelo.url} className="border-b border-blood">{e.khelo.name}</a>, [ONE LINE ABOUT THE GAMING CAFE].
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[860px] px-5 section reveal scroll-mt-4">
        <p className="eyebrow">FAQ</p>
        <h2 className="h2 mt-4">Before you <em>ask.</em></h2>
        <div className="mt-10 border-t border-line">
          {faqs.map(([q, a]) => (
            <details key={q} className="border-b border-line">
              <summary className="flex min-h-14 items-center justify-between gap-4 py-5 text-lg">
                {q}<span aria-hidden="true" className="plus text-xl text-crimson">+</span>
              </summary>
              <p className="muted mb-5 max-w-[60ch]">{a}</p>
            </details>
          ))}
        </div>
        <p className="muted mt-8 text-sm">
          Lost your ticket? <Link href="/find-ticket" className="border-b border-blood text-fg">Find my ticket</Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
