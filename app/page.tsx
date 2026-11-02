import Image from "next/image";
import Link from "next/link";
import { eventConfig as e } from "@/config/event";
import { KheloPartner, KheloStrip } from "@/components/Khelo";
import { Logo } from "@/components/Logo";
import { PassPicker } from "@/components/PassPicker";
import { SiteFooter } from "@/components/SiteFooter";

// Static: built at deploy, zero DB calls on render. Availability arrives via PassPicker.
export const dynamic = "force-static";

const faqs: [string, string][] = [
  ["How do I buy a ticket?", "Pick a pass, enter your details, and pay the exact amount by UPI. Then enter the UTR (reference number) from your payment and upload a screenshot."],
  ["When do I get my ticket?", "We check every payment against our bank account by hand, then email your ticket as a PDF. You'll also see it on your order page. Please allow some time; it is not instant."],
  [
    "I paid but haven't got my ticket.",
    `Check your spam folder, then use “Find my ticket” in the footer. Still nothing? WhatsApp ${e.organiser.whatsapp} with your phone number and payment screenshot.`,
  ],
  ["I lost my ticket or the email.", "Use “Find my ticket” in the footer with the email or phone number you booked with, and we'll email your ticket links again. Or we look you up at the door with your name, phone number and ID."],
  ["Who can come?", `${e.ageLimit}. Bring a valid government photo ID.`],
  ["Is my ticket transferable?", `${e.policy.transferable}. Each QR works once. Whoever's code is scanned first gets in, so don't post it publicly.`],
  ["What about refunds?", `${e.policy.refundPolicy}. ${e.policy.transferable}. ${e.policy.reentry}. See the Terms in the footer.`],
];

const photos = [
  { src: "/images/last-blue.webp", w: 900, h: 1200, alt: "Blue beams cutting through the dark in front of the Project Y2K screen", cls: "" },
  { src: "/images/last-smoke.webp", w: 900, h: 1200, alt: "Smoke and the Project Y2K logo on the big screen, in black and white", cls: "" },
  { src: "/images/last-dj.webp", w: 720, h: 1280, alt: "The DJ under the Project Y2K screen with the crowd in front", cls: "col-span-2 sm:col-span-1 [&_img]:aspect-[4/3] sm:[&_img]:aspect-[3/4]" },
];

export default function Home() {
  return (
    <main id="top" className="overflow-x-clip">
      <KheloStrip />
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

      {/* HERO: the one place with theatre */}
      <section className="relative overflow-hidden">
        <div className="wrap flex flex-wrap items-center gap-x-14 gap-y-10 pt-14 pb-16 md:pb-20">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="in eyebrow" style={{ "--i": 0 } as React.CSSProperties}>✦ {e.dateLabel}</p>
            <h1 className="in mt-5 font-normal" style={{ "--i": 1 } as React.CSSProperties}>
              <Image src="/images/y2k26-logo.webp" alt="Project Y2K26" width={760} height={585} priority sizes="(min-width: 768px) 460px, 86vw" className="h-auto w-[min(86vw,460px)]" />
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
              Pay by UPI · PDF ticket by email once verified · Non-refundable, no re-entry
            </p>
            <p className="in mt-4 text-sm" style={{ "--i": 7 } as React.CSSProperties}>
              Already booked? <Link href="/find-ticket" className="border-b border-blood">Find my ticket</Link>
            </p>
          </div>
          <div className="in relative mx-auto aspect-[920/1140] w-full max-w-[460px] flex-[1_1_320px]" style={{ "--i": 3 } as React.CSSProperties}>
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
          <p><span className="text-crimson">01</span>&nbsp; Every payment checked by a real person</p>
          <p><span className="text-crimson">02</span>&nbsp; Exact price shown before you pay. No surprises</p>
          <p><span className="text-crimson">03</span>&nbsp; Real people on WhatsApp: {e.organiser.whatsapp}</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" aria-labelledby="how-h" className="wrap section reveal">
        <p className="eyebrow">Simple</p>
        <h2 id="how-h" className="h2 mt-4">How to get <em>your ticket.</em></h2>
        <ol className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pick a pass", "Choose your pass and enter your name, phone and email."],
            ["Pay by UPI", "Scan the QR or tap “Open my UPI app”. Pay the exact amount shown."],
            ["Send proof", "Enter the 12-digit UTR from your payment and upload a screenshot."],
            ["Get your ticket", "We verify your payment, then email your PDF ticket. Show the QR at the door."],
          ].map(([t, d], i) => (
            <li key={t} className="border-t border-line pt-4">
              <p className="font-display text-3xl text-crimson">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-lg font-semibold">{t}</p>
              <p className="muted mt-1 text-sm leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* LAST TIME */}
      <section id="last" className="wrap section reveal">
        <p className="eyebrow">The last one</p>
        <h2 className="h2 mt-4">Y2K 1.0, <em>The Index.</em></h2>
        <p className="muted mt-4 max-w-[60ch]">At Illuzion: a DJ all day, matchmaking, and a photo booth running throughout.</p>
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
            <a href={e.venue.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-quiet self-end" aria-label="Open map in Google Maps (new tab)">Open map <span aria-hidden="true">↗</span></a>
          )}
        </div>
      </section>

      {/* PASSES */}
      <section id="passes" className="wrap section scroll-mt-4">
        <p className="eyebrow">Passes</p>
        <h2 className="h2 mt-4">Pick your <em>pass.</em></h2>
        <p className="muted mt-4 max-w-[56ch]">The price you see is the price you pay. Your ticket is emailed once we've verified your payment.</p>
        <PassPicker />
        <ol className="muted mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          <li><span className="text-crimson">1</span>&nbsp; Pay the exact amount by UPI</li>
          <li><span className="text-crimson">2</span>&nbsp; Enter the UTR and upload your screenshot</li>
          <li><span className="text-crimson">3</span>&nbsp; We verify it, then email your PDF ticket</li>
        </ol>
      </section>

      {/* ABOUT */}
      <section className="band border-b-0">
        <div className="wrap section reveal">
          <p className="eyebrow">About</p>
          <h2 className="h2 mt-4">Who&apos;s <em>behind it.</em></h2>
          <p className="muted mt-6 max-w-[56ch]">
            Project Y2K is a party series. Y2K 1.0, The Index, was held at Illuzion. This year it&apos;s The Matrix: Hyderabad&apos;s first theatre rave, at {e.venue.name}.
          </p>
          <p className="muted mt-4 max-w-[56ch]">{e.organiser.name} · WhatsApp {e.organiser.whatsapp} · {e.organiser.instagram}</p>
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

      <KheloPartner />
      <SiteFooter />
    </main>
  );
}
