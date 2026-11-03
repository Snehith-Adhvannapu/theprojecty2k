// The original landing page wording. Admins can override any of it in Admin > Page text.
// In headings and paragraphs, *words between stars* are shown in the accent style.
import { eventConfig as e } from "@/config/event";

export interface About { heading: string; lead: string; paras: string[]; closer: string; note: string }
export interface Landing {
  about: About;
  trust: string[];
  how: { eyebrow: string; heading: string; steps: { title: string; text: string }[] };
  last: { eyebrow: string; heading: string; lead: string; paras: string[] };
  details: { label: string; value: string }[];
  passes: { eyebrow: string; heading: string; intro: string; steps: string[] };
  who: { eyebrow: string; heading: string; paras: string[] };
  faq: { q: string; a: string }[];
}

export function landingDefaults(): Landing {
  return {
    about: { ...e.about, paras: [...e.about.paras], note: "Pay by UPI · PDF ticket by email once verified · Non-refundable, no re-entry" },
    trust: [
      "Every payment checked by a real person",
      "Exact price shown before you pay. No surprises",
      `Real people on WhatsApp: ${e.organiser.whatsapp}`,
    ],
    how: {
      eyebrow: "Simple",
      heading: "How to get *your ticket.*",
      steps: [
        { title: "Pick a pass", text: "Choose your pass and enter your name, phone and email." },
        { title: "Pay by UPI", text: "Scan the QR or tap “Open my UPI app”. Pay the exact amount shown." },
        { title: "Send proof", text: "Enter the 12-digit UTR from your payment and upload a screenshot." },
        { title: "Get your ticket", text: "We verify your payment, then email your PDF ticket. Show the QR at the door." },
      ],
    },
    last: {
      eyebrow: "The last one",
      heading: "Y2K 1.0 — *The Index.*",
      lead: "Where it all began.",
      paras: [
        "An unforgettable day at Illuzion, bringing together music, connections and the Y2K experience. With DJs playing throughout, spontaneous matchmaking and a photo booth capturing the moments, this was more than just another party.",
        "The beginning of something bigger. *And we’re only getting started.*",
      ],
    },
    details: [
      { label: "Date", value: e.dateLabel },
      { label: "Doors", value: e.doorsOpen },
      { label: "Music", value: `${e.musicFrom} to ${e.musicUntil}` },
      { label: "Venue", value: `${e.venue.name}, ${e.venue.address}` },
      { label: "Age", value: e.ageLimit },
      { label: "Dress", value: e.dressCode },
    ],
    passes: {
      eyebrow: "Passes",
      heading: "Pick your *pass.*",
      intro: "The price you see is the price you pay. Your ticket is emailed once we've verified your payment.",
      steps: ["Pay the exact amount by UPI", "Enter the UTR and upload your screenshot", "We verify it, then email your PDF ticket"],
    },
    who: {
      eyebrow: "About",
      heading: "Who's *behind it.*",
      paras: [
        `Project Y2K is a party series. Y2K 1.0, The Index, was held at Illuzion. This year it's The Matrix: Hyderabad's first theatre rave, at ${e.venue.name}.`,
        `${e.organiser.name} · WhatsApp ${e.organiser.whatsapp} · ${e.organiser.instagram}`,
      ],
    },
    faq: [
      { q: "How do I buy a ticket?", a: "Pick a pass, enter your details, and pay the exact amount by UPI. Then enter the UTR (reference number) from your payment and upload a screenshot." },
      { q: "When do I get my ticket?", a: "We check every payment against our bank account by hand, then email your ticket as a PDF. You'll also see it on your order page. Please allow some time; it is not instant." },
      { q: "I paid but haven't got my ticket.", a: `Check your spam folder, then use “Find my ticket” in the footer. Still nothing? WhatsApp ${e.organiser.whatsapp} with your phone number and payment screenshot.` },
      { q: "I lost my ticket or the email.", a: "Use “Find my ticket” in the footer with the email or phone number you booked with, and we'll email your ticket links again. Or we look you up at the door with your name, phone number and ID." },
      { q: "Who can come?", a: `${e.ageLimit}. Bring a valid government photo ID.` },
      { q: "Is my ticket transferable?", a: `${e.policy.transferable}. Each QR works once. Whoever's code is scanned first gets in, so don't post it publicly.` },
      { q: "What about refunds?", a: `${e.policy.refundPolicy}. ${e.policy.transferable}. ${e.policy.reentry}. See the Terms in the footer.` },
    ],
  };
}
