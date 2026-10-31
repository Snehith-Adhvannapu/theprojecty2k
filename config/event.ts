// All event content lives here. Anything in [BRACKETS] is a placeholder: supply the
// real fact before going live. Never invent venue, prices, lineup, numbers or sponsors.
// Pass names, prices and quantities are NOT here: they are managed in /admin.

export const eventConfig = {
  name: "Project Y2K",
  tagline: "Live beyond reality.",
  description: "The Matrix: Hyderabad's first theatre rave. Y2K 1.0, The Index, at Illuzion had a DJ all day, matchmaking and a photo booth running throughout.",
  date: "2026-11-15", // fixed by the brief
  dateLabel: "15 November 2026",
  doorsOpen: "12:00 PM",
  musicFrom: "1:00 PM",
  musicUntil: "5:00 PM",
  venue: {
    name: "Prasad's IMAX",
    address: "Hyderabad",
    mapUrl: "https://maps.app.goo.gl/cVJ1G3j6faKFnfRw8",
  },
  ageLimit: "No age limit",
  dressCode: "Dark colours (preferably black)",
  rules: [
    "No damaging theatre property",
    "No touching the screen",
    "No alcohol will be served",
    "No smoking",
    "No e-cigarettes",
    "Play fair and play by the rules",
  ],
  organiser: {
    name: "Project.Y2k",
    address: "NCC Urban Nagarjuna Residency",
    whatsapp: "+91 90522 57297",
    email: "projecty2k.2k26@gmail.com",
    instagram: "@theproject.y2k",
    supportHours: "Any time",
    eventDayHelpline: "9052257297, 7093967777, 7386085052",
  },
  policy: {
    // Pick one and fill the blanks in the Refund page. State it plainly.
    refundPolicy: "Tickets are non-refundable",
    refundDays: "[X]",
    transferable: "No, tickets are non-transferable",
    reentry: "No re-entry",
    dataRetention: "until the event accounts are settled",
    governingCity: "Hyderabad, Telangana",
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
