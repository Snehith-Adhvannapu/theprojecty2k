// All event content lives here. Anything in [BRACKETS] is a placeholder: supply the
// real fact before going live. Never invent venue, prices, lineup, numbers or sponsors.
// Pass names, prices and quantities are NOT here: they are managed in /admin.

export const eventConfig = {
  name: "Project Y2K",
  tagline: "[TAGLINE]",
  description: "[ONE OR TWO TRUE SENTENCES ABOUT THE PARTY. REFERENCE LAST YEAR'S PARTY.]",
  date: "2026-11-15", // fixed by the brief
  dateLabel: "15 November 2026",
  doorsOpen: "[DOORS OPEN HH:MM]",
  musicUntil: "[MUSIC UNTIL HH:MM]",
  venue: {
    name: "[VENUE NAME]",
    address: "[FULL ADDRESS]",
    mapUrl: "", // [MAP LINK] — leave empty to hide the button
  },
  ageLimit: "[AGE LIMIT, e.g. 18+]",
  dressCode: "[DRESS CODE]",
  rules: ["[LIST YOUR REAL RULES]"],
  organiser: {
    name: "[ORGANISER / BUSINESS NAME]",
    address: "[REGISTERED OR OPERATING ADDRESS]",
    whatsapp: "[WHATSAPP NUMBER]",
    email: "[SUPPORT EMAIL]",
    instagram: "[@HANDLE]",
    supportHours: "[DAYS / HOURS]",
    eventDayHelpline: "[NUMBER]",
  },
  policy: {
    // Pick one and fill the blanks in the Refund page. Razorpay wants this stated plainly.
    refundPolicy: "[Tickets are non-refundable / refundable until DD Month 2026]",
    refundDays: "[X]",
    transferable: "[Yes / No]",
    reentry: "[RE-ENTRY POLICY]",
    dataRetention: "[X months]",
    governingCity: "[CITY, STATE]",
  },
  khelo: { name: "Khelo", url: "https://khel-o.com" },
  limits: { maxPassesPerOrder: 4, holdMinutes: 10, maxPendingPerPhone: 2 },
};

export const isPlaceholder = (s: string) => /\[[^\]]+\]/.test(s);
export type EventConfig = typeof eventConfig;
