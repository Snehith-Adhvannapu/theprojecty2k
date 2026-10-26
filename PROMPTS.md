# Phase prompts (paste one per Claude Code session)

Start each session with: "Read CLAUDE.md, SPEC.md and Y2K_SPEC_ADDENDUM.md. Use Plan Mode first and show me the plan."

## Phase 0: scaffold (15 min)
Create the Next.js (App Router, TypeScript) project with the layout in CLAUDE.md. Wire Tailwind to `design/tokens.css`, load Bebas Neue, Cormorant Garamond and Manrope via `next/font`. Add Vitest, Playwright, Zod, Drizzle config, a `.env.example` listing the vars in CLAUDE.md, and `config/event.ts` with placeholders. No features yet.

## Phase 1: schema and seed
Write the Drizzle schema and migrations for events, pass_types, orders, order_items, payments, tickets, checkins, staff_users, audit_logs, email_outbox, with every constraint from SPEC.md section 9 and the deltas in the addendum section 3 (short_code, admits, used_at/used_by, client_event_id, idempotency_key, unique provider_payment_id). Add indexes for lookups by phone, name, short_code, token_hash. Seed one event, three placeholder passes (one with admits=2) and two staff users. Commit.

## Phase 2: core logic with tests first
In `lib/inventory`, `lib/payments`, `lib/tickets`, `lib/checkin`, write the tests first (including the concurrency cases in CLAUDE.md invariant 10), then implement: reserve inventory, confirm payment idempotently, late-payment re-reserve or needs_refund, issue tickets with hashed tokens and short codes, atomic check-in. Raw SQL for atomic parts. All tests green before moving on.

## Phase 3: routes
Implement `GET /api/event`, `GET /api/event/availability` (edge-cached), `POST /api/orders` (idempotency key, Zod, per-phone pending cap), `POST /api/payments/initiate`, `POST /api/webhooks/razorpay` (signature check, idempotent), `GET /api/orders/:id/status` (polls, falls back to a server-side gateway fetch after ~10s), `GET /api/tickets/:token`. Send the ticket email via `email_outbox` with retry on next hit. Test the whole flow in Razorpay test mode, including closing the browser mid-payment.

## Phase 4: scanner and lookup (before any pixel polish)
Build `/scan`: login, continuous camera scan (dynamic import), `POST /api/scan`, the four fixed states from `design/reference/Scanner.dc.html`, sound and vibration, network failure shown as amber (never red or green). Add Find guest (name, phone last 4, short code) with an ADMIT button logged as manual. Add Playwright tests: two parallel scans of one token, offline simulation shows amber.

## Phase 5: public UI
Build the landing page, checkout, and ticket page to match `design/reference/Main.dc.html`, `Checkout.dc.html`, `Ticket.dc.html` using tokens only. Landing static with one client island (`PassPicker`). Ticket page renders the QR client-side from the token, is cached for offline, and shows ADMITS n, the short code, and "Powered by Khelo". Check at 390px and 1280px, iterate 2 to 3 times per screen. Add Terms, Privacy, Refund and Contact pages using the copy in the addendum with placeholders.

## Phase 6: admin
Build `/admin` per `Admin.dc.html`: counts, needs-attention banner, money (gross, refunds, fees, net with definitions), guest search, check-in history, pass toggles, volunteer accounts, revoke, comp ticket with reason, CSV exports, print list, reconcile with gateway, `/admin/health`. Server-side role checks on every route; audit log on every sensitive action.

## Phase 7: offline mode
Add the scanner PWA local mode per addendum section 2 layer 3: guest-list snapshot in IndexedDB (hashed tokens, minimal fields), blue offline state, queued events with `client_event_id`, auto-sync via `POST /api/scan/sync`, duplicates flagged `duplicate_offline`. Playwright with `context.setOffline(true)`.

## Phase 8: hardening review (fresh session)
Review only `lib/payments`, `lib/tickets`, `lib/checkin`, the webhook and scan routes, and auth. Try to find ways to get a free ticket, double entry, an oversell, or a leaked token or phone number. Report findings before changing code.
