// All event content lives here. Anything in [BRACKETS] is a placeholder: supply the
// real fact before going live. Never invent venue, prices, lineup, numbers or sponsors.
// Pass names, prices and quantities are NOT here: they are managed in /admin.

export const eventConfig = {
  name: "Project Y2K",
  tagline: "Live beyond reality.",
  // Landing copy, shown under the poster.
  about: {
    heading: "Hyderabad’s First-Ever Theatre Rave",
    lead: "Forget everything you know about a party.",
    paras: [
      "PROJECT Y2K × HYD HIGH presents THE MATRIX — an entirely new dimension of sound, visuals and energy.",
      "Step inside a cinematic world where the boundaries between music and visuals disappear. Experience electrifying beats, immersive visuals, powerful sound and an atmosphere designed to take you beyond the ordinary.",
      "This isn’t just another night out. It’s a reality of its own.",
    ],
    closer: "One screen. One sound. One unreal experience.",
  },
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
    whatsapp: "+91 70939 67777",
    email: "projecty2k.2k26@gmail.com",
    instagram: "@theproject.y2k",
    supportHours: "Any time",
    eventDayHelpline: "9052257297, 7093967777, 7386085052",
  },
  policy: {
    // Shown in the Terms and FAQ. State it plainly.
    refundPolicy: "Tickets are non-refundable",
    transferable: "No, tickets are non-transferable",
    reentry: "No re-entry",
    dataRetention: "until the event accounts are settled",
    governingCity: "Hyderabad, Telangana",
  },
  // Manual UPI payment. Set NEXT_PUBLIC_UPI_ID / NEXT_PUBLIC_UPI_PAYEE in the host env, or edit here.
  payment: {
    upiId: process.env.NEXT_PUBLIC_UPI_ID || "Q022698137@ybl",
    payeeName: process.env.NEXT_PUBLIC_UPI_PAYEE || "Project Y2K",
    // What the buyer's UPI app actually shows as the account name (set NEXT_PUBLIC_UPI_NOTE), so nobody panics.
    accountNote: process.env.NEXT_PUBLIC_UPI_NOTE || "",
    reviewHoldHours: 24,
  },
  limits: { maxPassesPerOrder: 15, holdMinutes: 45, maxPendingPerPhone: 2 },
};

export const isPlaceholder = (s: string) => /\[[^\]]+\]/.test(s);
export type EventConfig = typeof eventConfig;
