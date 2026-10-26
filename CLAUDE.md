# Project Y2K: ticketing site

Single-event ticketing for one party on 15 Nov 2026, about 300 attendees. Not a SaaS. Ship fast, never compromise payment correctness, ticket validity, or duplicate-entry prevention.

## Read first
- `SPEC.md`: the full plan and requirements.
- `Y2K_SPEC_ADDENDUM.md`: performance rules, outage layers, payment edge cases, test additions, trust-page copy.
- `design/tokens.css`: the only source of colors, radii, fonts.
- `design/reference/*.dc.html`: visual reference for each screen (landing, checkout, ticket, scanner states, admin, tokens). Open the live canvas or read the markup. Bracketed text like `[VENUE]` means content to be supplied, never invent it.

## Stack (verify every version and free-tier limit from official docs; do not trust memory)
- Next.js App Router + TypeScript, one app, no separate backend.
- Neon Postgres (pooled connection string). Drizzle for schema and migrations. Raw SQL for atomic operations.
- Zod on every input. Razorpay in test mode until the account is approved.
- Email: Resend or Brevo (check send limits). Staff auth: Better Auth or Auth.js, credentials only. No Google auth.
- QR generation: `qrcode`. Scanner: a maintained browser QR lib, dynamically imported on `/scan` only.
- Tailwind wired to the tokens. Vitest for logic, Playwright for flows.
- No Redis, no queues, no websockets, no workers.

## Money-path invariants (non-negotiable)
1. A payment is confirmed only by a signature-verified webhook, or a server-side fetch of the payment from the gateway. The success page only polls order status.
2. `payments.provider_payment_id` is unique. Duplicate webhooks are a no-op that still return 200.
3. Reserve inventory inside a transaction that locks the pass-type row (`SELECT ... FOR UPDATE`). Available = total - sold - active unexpired reservations. Expiry is evaluated at read time, no cron.
4. Payment arriving after reservation expiry: try to re-reserve atomically; if stock is gone, mark `needs_refund` and surface it in admin. Never drop a paid order.
5. Check-in is one statement: `UPDATE tickets SET status='used', used_at=now(), used_by=$staff WHERE token_hash=$hash AND status='valid' RETURNING ...`. Zero rows means reject; a follow-up SELECT decides the reason.
6. Ticket tokens: 32 random bytes, base64url. Store only the sha256 hash. The QR holds the token only, never personal data. Tickets also carry a short code (unambiguous alphabet, checksum).
7. Every `/api/admin/*` and `/api/staff/*` route checks the role on the server. Hiding a button is not authorization.
8. Times stored in UTC, shown in IST. Phones normalized to +91 E.164, Instagram handles stripped of `@` and URLs, emails lowercased.
9. Never log tokens, full phone numbers, or secrets.
10. No change to `lib/payments`, `lib/tickets`, `lib/inventory`, `lib/checkin` without tests, including concurrency tests (20 parallel reservations on 1 pass; 2 parallel scans of one token; same webhook 5 times).

## Layout
```
app/                 routes only (page.tsx, checkout, t/[token], scan, admin/*, api/*)
lib/                 inventory, payments, tickets, checkin, email, auth, db
components/          UI
config/event.ts      all event content as placeholders until supplied
design/tokens.css    design tokens
design/reference/    visual references
```
Routes are thin: validate with Zod, call a `lib` function, return `{ ok, data | error: { code, message } }`. No stack traces to users.

## UI rules
- Colors, radii, fonts from tokens only. No ad-hoc colors, shadows, glass, or glow cards.
- Chrome-noir drama on the landing hero only. Checkout, ticket, policies, scanner: Manrope 16px+, high contrast, no chrome text.
- Mobile first at 390px, then check 1280px. Inputs 16px, tap targets 44px minimum, honor `prefers-reduced-motion`.
- Landing is static (no DB on render). Availability comes from one cached endpoint. Images via `next/image`, WebP, explicit dimensions, lazy except the hero.
- Every async button has idle, loading, error, and success states. Pay button disables on tap; checkout carries an idempotency key.
- Scanner states are fixed and unmistakable: green admit, red reject, amber no connection (never red or green), blue offline admit.

## Env vars (never commit)
`DATABASE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `EMAIL_API_KEY`, `EMAIL_FROM`, `AUTH_SECRET`, `APP_URL`.

## Working agreements
- Use Plan Mode at the start of each phase. One phase per session. Commit after each green test run.
- For UI work, run the dev server, view at 390px and 1280px, compare with the reference, fix, repeat 2 to 3 times.
- Test mode only. No live keys, no real-money tests, no production deploys without being asked.
- Do not invent event facts (venue, prices, lineup, attendance numbers, sponsors). Use `config/event.ts` placeholders.
- "Powered by Khelo" appears in the footer, ticket page, and ticket email only.
