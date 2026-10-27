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
    // Pick one and fill the blanks in the Refund page. State it plainly.
    refundPolicy: "[Tickets are non-refundable / refundable until DD Month 2026]",
    refundDays: "[X]",
    transferable: "[Yes / No]",
    reentry: "[RE-ENTRY POLICY]",
    dataRetention: "[X months]",
    governingCity: "[CITY, STATE]",
  },
  // Manual UPI payment. Set NEXT_PUBLIC_UPI_ID / NEXT_PUBLIC_UPI_PAYEE in the host env, or edit here.
  payment: {
    upiId: process.env.NEXT_PUBLIC_UPI_ID || "[UPI ID]",
    payeeName: process.env.NEXT_PUBLIC_UPI_PAYEE || "[PAYEE NAME]",
    reviewHoldHours: 24,
  },
  khelo: { name: "Khelo", url: "https://khel-o.com" },
  limits: { maxPassesPerOrder: 4, holdMinutes: 45, maxPendingPerPhone: 2 },
};

export const isPlaceholder = (s: string) => /\[[^\]]+\]/.test(s);
export type EventConfig = typeof eventConfig;
