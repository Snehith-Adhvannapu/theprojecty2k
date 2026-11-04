import { getLanding } from "@/lib/site-content";
import { query } from "@/lib/db";
import { structuredData } from "@/lib/seo";
import { Rich } from "@/components/Rich";
import Image from "next/image";
import Link from "next/link";
import { eventConfig as e } from "@/config/event";
import { Logo } from "@/components/Logo";
import { PassPicker } from "@/components/PassPicker";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/StickyCta";
import { WelcomeBack } from "@/components/WelcomeBack";

// Static: built at deploy, zero DB calls on render. Availability arrives via PassPicker.
export const dynamic = "force-static";

const photos = [
  { src: "/images/last-blue.webp", w: 900, h: 1200, alt: "Blue beams cutting through the dark in front of the Project Y2K screen", cls: "" },
  { src: "/images/last-smoke.webp", w: 900, h: 1200, alt: "Smoke and the Project Y2K logo on the big screen, in black and white", cls: "" },
  { src: "/images/last-dj.webp", w: 720, h: 1280, alt: "The DJ under the Project Y2K screen with the crowd in front", cls: "col-span-2 sm:col-span-1 [&_img]:aspect-[4/3] sm:[&_img]:aspect-[3/4]" },
];

/** Lowest and highest active pass price for the Event markup. Read once at build; a pass edit revalidates the page. */
async function passPrices() {
  try {
    const [r] = await query("SELECT min(price_paise)::int AS low, max(price_paise)::int AS high, count(*)::int AS n FROM pass_types WHERE active");
    return r && r.n > 0 ? { low: r.low as number, high: r.high as number, count: r.n as number } : null;
  } catch {
    return null; // no DB at build time: leave the price out rather than guess
  }
}

export default async function Home() {
  const L = await getLanding();
  const about = L.about;
  const ld = JSON.stringify(structuredData(await passPrices())).replace(/</g, "\\u003c");
  return (
    <main id="top" className="overflow-x-clip pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="wrap flex items-center justify-between gap-4 py-1.5">
          <Logo tag="The Matrix" />
          <nav aria-label="Primary" className="flex items-center gap-x-5 sm:gap-x-7">
            <a href="#last" className="muted hidden min-h-11 items-center text-xs uppercase tracking-[0.25em] transition-colors hover:text-fg sm:inline-flex">Last time</a>
            <a href="#faq" className="muted hidden min-h-11 items-center text-xs uppercase tracking-[0.25em] transition-colors hover:text-fg sm:inline-flex">FAQ</a>
            <Link href="/find-ticket" className="hidden min-h-11 items-center whitespace-nowrap text-xs sm:inline-flex uppercase tracking-[0.2em] transition-colors hover:text-crimson">My ticket</Link>
            <a href="#passes" className="btn min-h-11 whitespace-nowrap px-4 text-xs sm:px-5">Get passes</a>
          </nav>
        </div>
      </header>
      <WelcomeBack />

      {/* HERO: the one place with theatre */}
      <section className="relative overflow-hidden">
        <div className="wrap flex flex-wrap items-center gap-x-14 gap-y-10 pt-14 pb-16 md:pb-20">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="in eyebrow" style={{ "--i": 0 } as React.CSSProperties}>✦ {e.dateLabel}</p>
            <div className="in mt-5 max-w-[46ch]" style={{ "--i": 3 } as React.CSSProperties}>
              <h1 className="text-[22px] font-semibold leading-snug">
                {about.heading}
                <span className="sr-only"> | Project Y2K: The Matrix at {e.venue.name}, Hyderabad, {e.dateLabel}</span>
              </h1>
              {about.lead && <p className="mt-3 text-lg font-medium">{about.lead}</p>}
              {about.paras.map((t, i) => <p key={i} className="muted mt-3 whitespace-pre-line text-[17px] leading-relaxed">{t}</p>)}
              {about.closer && <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-crimson">{about.closer}</p>}
            </div>
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
              {about.note}
            </p>
            <p className="in mt-4 text-sm" style={{ "--i": 7 } as React.CSSProperties}>
              Already booked? <Link href="/find-ticket" className="border-b border-blood">Find my ticket</Link>
            </p>
          </div>
          <div className="in relative order-first aspect-[920/1140] w-full max-w-[460px] flex-[1_1_320px]" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="hero-glow absolute -inset-6 -z-10" style={{ background: "var(--glow)", opacity: 0.35 }} aria-hidden="true" />
            <Image src="/images/hero-poster.webp" alt="Poster: Project Y2K x Hyd High presents The Matrix. Hyderabad's first ever theatre rave. 15.11.2026, Prasads IMAX, 12 noon to 5PM." width={920} height={1140} priority sizes="(min-width: 768px) 460px, 90vw" className="h-full w-full rounded-sm border border-line object-cover" />
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
          {L.trust.map((t, i) => <p key={i}><span className="text-crimson">{String(i + 1).padStart(2, "0")}</span>&nbsp; {t}</p>)}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" aria-labelledby="how-h" className="wrap section reveal">
        <p className="eyebrow">{L.how.eyebrow}</p>
        <h2 id="how-h" className="h2 mt-4"><Rich text={L.how.heading} as="em" /></h2>
        <ol className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {L.how.steps.map((st, i) => (
            <li key={i} className="border-t border-line pt-4">
              <p className="font-display text-3xl text-crimson">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-lg font-semibold">{st.title}</p>
              <p className="muted mt-1 text-sm leading-relaxed">{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* LAST TIME */}
      <section id="last" className="wrap section reveal">
        <p className="eyebrow">{L.last.eyebrow}</p>
        <h2 className="h2 mt-4"><Rich text={L.last.heading} as="em" /></h2>
        {L.last.lead && <p className="mt-4 text-lg font-medium">{L.last.lead}</p>}
        {L.last.paras.map((t, i) => <p key={i} className={`mt-3 max-w-[60ch] whitespace-pre-line text-[17px] leading-relaxed ${i === 0 ? "muted" : ""}`}><Rich text={t} /></p>)}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.src} className={`min-w-0 ${p.cls}`}>
              <Image src={p.src} alt={p.alt} width={p.w} height={p.h} loading="lazy" sizes="(min-width: 768px) 33vw, 90vw" className="aspect-[3/4] w-full rounded-sm border border-line object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* DETAILS */}
      <section aria-label="Event details" className="band">
        <div className="wrap flex flex-wrap gap-x-12 gap-y-7 py-10">
          {L.details.map((d, i) => (
            <div key={i} className={d.label.toLowerCase() === "venue" ? "flex-[2_1_240px]" : "flex-[1_1_160px]"}>
              <p className="label">{d.label}</p>
              <p className="mt-2 font-serif text-[28px] leading-[1.1]">{d.value}</p>
            </div>
          ))}
          {e.venue.mapUrl && (
            <a href={e.venue.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-quiet self-end" aria-label="Open map in Google Maps (opens in a new tab)">Open map</a>
          )}
        </div>
      </section>

      {/* PASSES */}
      <section id="passes" className="wrap section scroll-mt-4">
        <p className="eyebrow">{L.passes.eyebrow}</p>
        <h2 className="h2 mt-4"><Rich text={L.passes.heading} as="em" /></h2>
        <p className="muted mt-4 max-w-[56ch]">{L.passes.intro}</p>
        <PassPicker />
        <ol className="muted mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          {L.passes.steps.map((t, i) => <li key={i}><span className="text-crimson">{i + 1}</span>&nbsp; {t}</li>)}
        </ol>
      </section>

      {/* ABOUT */}
      <section className="band border-b-0">
        <div className="wrap section reveal">
          <p className="eyebrow">{L.who.eyebrow}</p>
          <h2 className="h2 mt-4"><Rich text={L.who.heading} as="em" /></h2>
          {L.who.paras.map((t, i) => <p key={i} className={`muted max-w-[56ch] whitespace-pre-line ${i === 0 ? "mt-6" : "mt-4"}`}><Rich text={t} /></p>)}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[860px] px-5 section reveal scroll-mt-4">
        <p className="eyebrow">FAQ</p>
        <h2 className="h2 mt-4">Before you <em>ask.</em></h2>
        <div className="mt-10 border-t border-line">
          {L.faq.map(({ q, a }, i) => (
            <details key={i} className="border-b border-line">
              <summary className="flex min-h-14 items-center justify-between gap-4 py-5 text-lg">
                {q}<span aria-hidden="true" className="plus text-xl text-crimson">+</span>
              </summary>
              <p className="muted mb-5 max-w-[60ch] whitespace-pre-line">{a}</p>
            </details>
          ))}
        </div>
        <p className="muted mt-8 text-sm">
          Lost your ticket? <Link href="/find-ticket" className="border-b border-blood text-fg">Find my ticket</Link>
        </p>
      </section>

      <SiteFooter />
      <StickyCta />
    </main>
  );
}
