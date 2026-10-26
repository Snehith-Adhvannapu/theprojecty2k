# Project Y2K: implementation plan

Single-event ticketing site for one party on 15 Nov 2026, about 300 attendees. Companion files: `SPEC.md` (the original brief), `Y2K_SPEC_ADDENDUM.md` (outage, performance, edge cases, policy copy), `CLAUDE.md` (rules for Claude Code), `PROMPTS.md` (phase prompts), `design/` (tokens and visual reference).

Anything marked **VERIFY** is from memory and must be checked against official docs in Phase 0 before relying on it.

---

## 0. What we're building

A party-brand ticket site, mostly opened from Instagram and WhatsApp on phones. No accounts for buyers. Buy, pay, get a QR ticket instantly, walk in at the door.

**Pages**
- **Landing (`/`):** hero (name, date, one CTA), last-party photo wall and clip, reactions, event details, passes, about, FAQ, footer.
- **Checkout (`/checkout`):** pass and quantity, buyer details, itemized total, pay.
- **Ticket (`/t/[token]`):** big QR, short code, ADMITS n, name, venue, "Powered by Khelo". Works offline once opened.
- **Find my ticket:** enter phone or email, receive a link by email.
- **Policies:** Terms, Privacy, Refund and cancellation, Contact (needed for gateway approval).
- **Scanner (`/scan`):** volunteer login, camera, big full-screen states, Find guest.
- **Admin (`/admin`):** counts, search, passes, volunteers, exports, reconcile, health.

**Visual direction:** chrome-noir. Near-black ground, chrome-gradient display type, one crimson accent, grain, near-square corners. Theatre on the landing hero only; checkout, ticket and scanner stay calm and high-contrast so money and entry feel safe. Real photos from the last party carry the trust; no stock imagery, no fake testimonials, no invented numbers.

**Buyer data:** one set of details per order (name, phone, email, Instagram). Not per attendee; it kills conversion.

**Passes:** a pass has `admits` (1 or 2). A couple pass is one ticket, one QR, admits 2. Scanner shows ADMITS 2 in huge type.

---

## A. Executive recommendation

One Next.js app (App Router, TypeScript) with route handlers, one managed Postgres, Razorpay, a transactional email API. No separate backend, Redis, queues, or websockets.

Why: about 300 tickets and a burst of perhaps 30 to 60 order creations in the first minute is small. The hard parts are correctness (payments, inventory, entry), not scale, and correctness lives in the database, so one app plus Postgres transactions covers it. A second backend would add a deployment, secrets, CORS and a failure mode for zero benefit.

Honest caveats (VERIFY in Phase 0):
- Vercel Hobby's terms may exclude commercial use; ticket sales are commercial. Budget for one month of a paid plan if so.
- Free Postgres tiers may pause when idle or cap compute. Warm the DB before posting on Instagram.
- Free email tiers cap daily sends; 300 tickets plus retries could touch it. The ticket page is always the source of truth, so a failed email never loses a ticket.
- Razorpay approval (live site with policy pages, event ticketing category) is the real critical path, not the code.

## B. Architecture

```
 Buyer phone                         Volunteer phone               Admin
 (Instagram/WhatsApp)                (camera, PWA)                 (phone/laptop)
      |                                   |                           |
      |  HTTPS                            |  HTTPS                    |  HTTPS
      v                                   v                           v
 +----------------------------------------------------------------------+
 |                 Next.js app on Vercel (one deployment)               |
 |  static landing (CDN) | /api/* route handlers | /scan | /admin | /t   |
 +-----+--------------------+--------------------+----------------------+
       |                    |                    ^
       | SQL (pooled)       | create order,      | signed webhook
       v                    | fetch payment      | (payment.captured,
 +-------------+            v                    |  refund.*)
 |  Postgres   |      +-------------+            |
 | (source of  |      |  Razorpay   |------------+
 |   truth)    |      +-------------+
 +-------------+
       ^
       | outbox rows
       |                +-------------+
       +--------------> | Email API   |---> buyer inbox (ticket + QR + code)
                        +-------------+
```

**Payment flow:** buyer submits -> `POST /api/orders` reserves stock (10 min hold) -> `POST /api/payments/initiate` creates the gateway order -> buyer pays in the gateway sheet -> gateway sends a signed webhook -> server verifies the signature, marks payment captured, issues tickets in one transaction, queues the email -> the success page polls order status and shows the ticket once the order is `paid`. If the webhook is slow, after about 10 seconds the server fetches the payment status from the gateway itself. A browser "success" redirect never confirms anything.

**Entry flow:** volunteer scans -> `POST /api/scan` -> one conditional UPDATE decides admit or reject -> screen shows green, red, or amber (no connection).

## C. Features

**Essential for launch**
- Landing page with real photos, details, passes, FAQ, footer.
- Pass selection and quantity, checkout, itemized total, gateway payment.
- Webhook-verified confirmation, ticket issuance, ticket page, ticket email, "Find my ticket".
- Inventory that cannot oversell; 10-minute reservations, no cron.
- Scanner with volunteer logins, atomic check-in, four fixed states, Find guest (name, phone last 4, short code) with manual admit.
- Admin: counts, needs-attention list, guest search, revoke, pass toggles, volunteers, comp ticket (reason required), CSV exports, print list, reconcile with gateway, health page.
- Audit log for sensitive actions. Policy pages.

**Optional (after the core is live and verified)**
- Offline Local Mode in the scanner (snapshot, queue, sync). About 60 to 75 minutes.
- Short video clip on the hero, reaction wall polish, "X left" live counts, motion beyond one hero effect.
- In-app refund UI (v1: refund in the gateway dashboard; the webhook revokes tickets).
- Calendar-add, wallet passes, referral codes, analytics.

## D. Database (Postgres)

All times `timestamptz` (UTC). Money in integer paise.

| Table | Key fields | Constraints and indexes |
|---|---|---|
| `events` | id, name, starts_at, venue fields, status | one row for v1 |
| `pass_types` | id, event_id, name, description, price_paise, fee_paise, total_qty, admits (default 1), sales_start, sales_end, active, sort | check total_qty >= 0, admits >= 1 |
| `orders` | id, event_id, status (`pending` `paid` `expired` `failed` `needs_refund` `refunded`), buyer_name, buyer_phone (E.164), buyer_email, buyer_instagram, idempotency_key, amount_paise, fee_paise, expires_at, paid_at | unique(idempotency_key); idx(buyer_phone); idx(status, expires_at) |
| `order_items` | id, order_id, pass_type_id, qty, unit_price_paise | idx(pass_type_id) |
| `payments` | id, order_id, provider, provider_order_id, provider_payment_id, status (`created` `captured` `failed` `refunded`), amount_paise, fee_paise | unique(provider_order_id); unique(provider_payment_id) where not null |
| `webhook_events` | provider_event_id, type, received_at | unique(provider_event_id) |
| `tickets` | id, order_id, order_item_id, pass_type_id, token_hash, short_code, admits, status (`valid` `used` `revoked`), used_at, used_by, source (`purchase` `comp`) | unique(token_hash); unique(short_code); idx(order_id); idx(status) |
| `checkins` | id, ticket_id, staff_id, outcome (`admitted` `duplicate` `invalid` `revoked` `duplicate_offline`), method (`qr` `manual`), mode (`online` `offline_sync`), client_event_id, device_time, server_time | unique(client_event_id); idx(ticket_id) |
| `staff_users` | id, email, name, role (`admin` `volunteer`), password_hash, active | unique(email) |
| `audit_logs` | id, actor_id, action, target, meta jsonb, at | idx(at) |
| `email_outbox` | id, order_id, to_email, status (`pending` `sent` `failed`), attempts, last_error | idx(status) |

**Relationships:** event 1-N pass_types and orders; order 1-N order_items, payments, tickets; ticket 1-N checkins.

**Payment status and ticket status are separate.** A payment can be `captured` while its ticket is later `revoked` (refund). An order is `paid` only after a verified capture. Duplicate processing is blocked by unique provider ids; duplicate entry by the conditional UPDATE.

## E. Critical workflows

1. **Order creation.** Validate with Zod, normalize phone and handle. If `idempotency_key` exists, return that order. Cap pending orders per phone (2) and passes per order.
2. **Inventory reservation.** In one transaction: `SELECT ... FOR UPDATE` on the pass row; available = total - sold (paid tickets) - active reservations (pending, `expires_at > now()`); if short, fail cleanly ("only N left"); else insert order and items with `expires_at = now() + 10 min`. Expiry is read-time, no sweeper.
3. **Payment initiation.** Create the gateway order for the order's amount; store `provider_order_id`.
4. **Verification.** Webhook: verify HMAC signature on the raw body; insert `webhook_events` (duplicate means return 200 and stop); confirm amount and order match; mark payment captured and order paid; issue tickets; queue email; all in one transaction. Backup: a status poll older than ~10s triggers a server-side fetch of the payment from the gateway.
5. **Late payment.** Capture arrives after expiry: try to re-reserve atomically; if stock is gone, mark `needs_refund`, show at the top of admin, email the buyer. Never drop a paid order.
6. **Ticket generation.** Per admission unit: 32 random bytes (base64url) token, store only its sha256; generate a short code (unambiguous alphabet, checksum). QR contains the token only.
7. **Email.** Outbox row; send on webhook; retry on next ticket-page hit; admin Resend button. Email has the QR as attachment and the short code in text.
8. **Recovery.** `/t/[token]` link; "Find my ticket" emails the link to the address on file (never reveals whether an account exists).
9. **Refund.** Done in the gateway dashboard; the refund webhook marks the payment refunded and the tickets `revoked`; revoked tickets are rejected at the door. Freeze refunds at event day minus 3 hours.
10. **Atomic check-in.** `UPDATE tickets SET status='used', used_at=now(), used_by=$staff WHERE token_hash=$hash AND status='valid' RETURNING ...`. Zero rows means reject; a follow-up SELECT decides the reason. Every outcome writes a `checkins` row.

## F. Schedule (about 5 hours with Claude Code; offline mode extra)

| Time | Deliverable | Done when |
|---|---|---|
| 0:00 to 0:30 | Phase 0 scaffold; apply for Razorpay; stub policy pages | app runs, tokens wired, application submitted |
| 0:30 to 1:00 | Phase 1 schema, migrations, seed | migrations apply on a fresh DB, seed loads |
| 1:00 to 2:00 | Phase 2 core logic with concurrency tests | 20 parallel reservations on 1 pass: exactly 1 wins; 5 duplicate webhooks: 1 set of tickets; 2 parallel scans: 1 admit |
| 2:00 to 2:45 | Phase 3 routes and email; test-mode payment | full test purchase works, including closing the browser mid-payment |
| 2:45 to 3:30 | Phase 4 scanner and lookup | two phones scanning one QR: one green, one red; airplane mode shows amber |
| 3:30 to 4:30 | Phase 5 landing, checkout, ticket, policies | matches the references at 390px and 1280px |
| 4:30 to 5:00 | Phase 6 admin, then deploy preview and a real-phone test | counts, search, CSV, revoke, comp ticket work |
| +1:00 to 1:15 | Phase 7 offline mode (after the core is verified) | offline test queues and syncs; duplicates flagged |
| final | Phase 8 hardening review, rehearsal | acceptance checklist below passes |

Never leave payment correctness or entry validation to the last hours; they are Phases 2 to 4.

## G. Environment and deployment

**Services:** Vercel (app), Postgres host (Neon is the working assumption), Razorpay, email API (Resend or Brevo; needs a verified sending domain), a domain.

**Env vars (never commit):** `DATABASE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `EMAIL_API_KEY`, `EMAIL_FROM`, `AUTH_SECRET`, `APP_URL`.

**Setup order**
1. Create the DB, copy the pooled connection string; put the function region next to it.
2. Create the Vercel project, set env vars for Preview and Production (test keys on Preview).
3. Run migrations (`drizzle-kit migrate`) against each environment; seed Preview only.
4. Domain: point it at Vercel; add the email provider's DNS records (SPF, DKIM) and wait for verification (can take hours).
5. Razorpay: register the webhook URL `APP_URL/api/webhooks/razorpay`, select payment and refund events, set the secret. Use test keys until approved, then switch Production to live keys.
6. Create two admin accounts and the volunteer accounts.
7. Deploy preview, run a test-mode purchase on a real phone, then promote.

## H. Cost and capacity (all VERIFY)

- **Likely costs:** domain; possibly a paid Vercel plan if Hobby bars commercial use; gateway fees per transaction; everything else on free tiers.
- **Free-tier constraints to confirm:** Vercel commercial terms and function limits; Postgres storage, compute and idle-pause behavior; email daily and monthly send caps and domain verification; gateway onboarding, fees and webhook retry behavior.
- **Concurrent visitors vs requests vs transactions:** 100 visitors is mostly CDN hits on a static page. Perhaps 30 to 60 order creations in the first minute, each a few short queries. The row lock serializes buyers per pass type only for milliseconds. Simultaneous DB transactions stay in single digits.
- **Likely bottlenecks:** database cold start, gateway API latency, email send cap. Not CPU.
- **Burst behavior:** the landing page and availability endpoint are edge-cached, so the Instagram spike never reaches Postgres. Order creation is the only hot path. If stock runs out mid-burst, buyers see a clear "sold out / only N left" message, never a false confirmation.
- **Event day:** several volunteers scanning is a handful of writes per second at most.

## I. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Razorpay approval delayed or rejected | Medium | Cannot take payments | Apply first; live site with all policy pages; backup gateway (Cashfree) |
| Hobby-tier terms bar commercial use | Medium | Account suspension | Verify; pay for one month if needed |
| Paid but no ticket (missed webhook) | Low | Angry buyer, refund | Server-side payment fetch, reconcile button, needs-refund queue |
| Oversell on the last pass | Low | Refunds, reputation | Row lock plus tests with 20 parallel buyers |
| Duplicate entry | Low | Revenue loss | Conditional UPDATE; offline mode has a bounded gap (one lane while offline) |
| Venue internet or power failure | Medium | Slow entry | Amber state, offline local mode, printed A-Z list, power banks, hotspot on a different carrier |
| Email cap or spam folder | Medium | Buyers can't find ticket | Ticket page is source of truth; resend button; "Find my ticket" |
| Free DB pauses or cold-starts | Medium | Slow first request | Warm before launch; health page |
| Leaked admin or volunteer login | Low | Data exposure, free entries | Individual accounts, role checks server-side, audit log, revoke access |
| Last-minute scope changes (new pass types) | High | Schedule slip | Lock the pass menu early; passes are config, not code |
| Fake or hostile traffic on launch | Low | Noise, locked stock | Per-phone pending cap, 10-minute holds, host rate limiting |

## J. Acceptance checklist

**Before ticket sales go live**
- [ ] Test-mode purchase works end to end on a real phone, including closing the browser mid-payment.
- [ ] Duplicate webhook delivery creates one set of tickets.
- [ ] 20 parallel buyers on 1 remaining pass: exactly one succeeds.
- [ ] Failed and abandoned payments release stock after the hold.
- [ ] Ticket page shows QR, short code, ADMITS n; email arrives; "Find my ticket" works.
- [ ] Policy pages live with real details; Razorpay approved; live keys set; webhook secret matches.
- [ ] Two parallel scans of one ticket: one green, one red.
- [ ] Admin and scan routes reject unauthorized and wrong-role requests (volunteer cannot reach admin).
- [ ] Two admin accounts exist; DB backups confirmed.
- [ ] Landing page loads under 3 seconds on mid-range Android over 4G; checked at 390px and 1280px.

**Before the event**
- [ ] Test every volunteer phone (iPhone Safari and a budget Android Chrome), camera permission, daylight and low light.
- [ ] Check venue mobile signal; hotspot on a different carrier; power banks.
- [ ] Download the guest list on each scanner; test offline mode once.
- [ ] Print the A-Z list at T-24h and T-2h; keep the CSV on two admin phones.
- [ ] Freeze refunds at T-3h; reconcile payments against tickets (no `needs_refund` left).
- [ ] Rehearse: scan, duplicate, revoked, manual lookup, no-signal case.

## K. Open decisions

**Affect the build (answer before the phase that needs them)**
1. Who pays the gateway fee, buyer or organiser? (Checkout totals, Phase 3)
2. Refund policy: none, or until a date? Event cancellation rules. (Policy pages, Phase 5)
3. Are there door sales or a guest list? (Decides comp-ticket and cash handling, Phase 6)
4. Domain name, and the email-sending domain. (DNS takes time; do it today)
5. Pass menu locked: names, prices, quantities, sales windows, any couple pass.
6. Razorpay account holder (person or business) and whether approval is done.

**Content to fill in later (placeholders until supplied)**
Logo files, photos and clips, venue details, doors time, age and dress rules, organiser names and photo, WhatsApp number, email, Instagram handle, last-party numbers, FAQ and policy text, tagline.
