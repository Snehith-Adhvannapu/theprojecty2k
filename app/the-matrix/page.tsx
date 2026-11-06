import type { Metadata } from "next";
import Link from "next/link";
import { CalmShell } from "@/components/CalmShell";
import { eventConfig as e } from "@/config/event";
import { SITE_URL } from "@/lib/seo";

// A plain, crawlable page that answers the questions people (and AI answer engines) ask about the event.
// Every fact here comes from config/event.ts. The same questions are marked up as FAQPage for search.
const faqs = [
  { q: "What is Project Y2K: The Matrix?", a: `The Matrix is Hyderabad's first theatre rave, presented by Project Y2K and Hyd High on ${e.dateLabel}: music, visuals and sound on the big screen.` },
  { q: "When is The Matrix?", a: `${e.dateLabel}. Doors open at ${e.doorsOpen} and the music runs from ${e.musicFrom} to ${e.musicUntil}.` },
  { q: "Where is The Matrix?", a: `At ${e.venue.name.toLowerCase()}. It is a theatre in Hyderabad, India.` },
  { q: "Where can I buy tickets for The Matrix?", a: `Official tickets are sold on this website, ${SITE_URL.replace("https://", "")}. Choose a pass, pay by UPI, and your ticket is emailed to you as a PDF with a QR code once the payment is verified.` },
  { q: "How do I get my ticket after paying?", a: "After you pay by UPI and send the 12-digit UTR and a screenshot, the organisers check the payment by hand and email your ticket. You can also find it any time with the Find my ticket page." },
  { q: "Who can come?", a: `${e.ageLimit}. Everyone needs a valid government photo ID and their own ticket QR code.` },
  { q: "Is there a dress code?", a: `${e.dressCode}.` },
  { q: "Who is organising it?", a: `${e.organiser.name}. WhatsApp ${e.organiser.whatsapp} or Instagram ${e.organiser.instagram}.` },
];

export const metadata: Metadata = {
  title: "Tickets, date and details",
  description: `Official tickets and details for Project Y2K: The Matrix, Hyderabad's first theatre rave, on ${e.dateLabel}. Date, time, what to bring and how to buy.`,
  alternates: { canonical: "/the-matrix" },
};

export default function TheMatrix() {
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");
  return (
    <CalmShell right="The Matrix" width="max-w-[720px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <article className="mt-6 max-w-[68ch]">
        <h1 className="text-[28px] leading-[1.15]">Project Y2K: The Matrix. Tickets and details.</h1>
        <p className="muted mt-3 text-[17px] leading-relaxed">
          Hyderabad&apos;s first theatre rave, on {e.dateLabel}. Official tickets are sold right here at projecty2k.com.
        </p>
        <p className="mt-6">
          <Link href="/#passes" className="btn btn-primary btn-calm px-6">Get your tickets</Link>
        </p>

        <h2 className="mt-10 text-xl">Quick facts</h2>
        <dl className="mt-3 divide-y divide-line border-y border-line">
          {[
            ["Event", "Project Y2K: The Matrix (Project Y2K x Hyd High)"],
            ["Date", e.dateLabel],
            ["Doors", e.doorsOpen],
            ["Music", `${e.musicFrom} to ${e.musicUntil}`],
            ["Venue", e.venue.name],
            ["Age", e.ageLimit],
            ["Dress", e.dressCode],
            ["Tickets", "Sold at projecty2k.com, pay by UPI, ticket emailed as a PDF"],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7rem_1fr] gap-4 py-3">
              <dt className="muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-10 text-xl">Questions</h2>
        <div className="mt-3 flex flex-col gap-6">
          {faqs.map((f) => (
            <section key={f.q}>
              <h3 className="text-[17px] font-semibold">{f.q}</h3>
              <p className="muted mt-1.5 leading-relaxed">{f.a}</p>
            </section>
          ))}
        </div>
      </article>
    </CalmShell>
  );
}
