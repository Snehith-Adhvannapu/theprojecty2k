# Project Y2K: Spec Addendum
Performance, outage resilience, edge cases, trust copy.
Claude Code: read this before touching scanner, check-in, payments, or inventory.

---

## 1. Performance contract ("feels fast")

Targets on a mid-range Android over 4G: LCP < 2.5s, usable < 3s, checkout never blocked by visual effects.

1. **Landing page is static.** Built at deploy, served from the CDN. Zero DB calls on render.
2. **Live availability = one tiny endpoint**, `GET /api/event/availability`, cached at the edge (`s-maxage=5, stale-while-revalidate=30`). The Instagram burst hits the CDN, not Postgres. Only order creation checks real inventory.
3. **Images:** `next/image`, WebP/AVIF, explicit width/height (no layout shift). Only the hero is `priority`; the photo wall is lazy. Compress sources before commit (max 1600px, under 200KB each).
4. **Video:** poster image first, load the clip when in view, skip on Save-Data or slow connections. Muted, `playsInline`, under 2MB.
5. **Fonts:** max 2, self-hosted via `next/font`, subset, `display: swap`.
6. **JS budget:** server components by default. Client JS only for pass picker, checkout form, scanner. Scanner library and Razorpay script load only on their own routes (dynamic import). No animation library: CSS plus one hero effect. Respect `prefers-reduced-motion`.
7. **Perceived speed:** pass picker updates instantly (client state), skeletons instead of spinners, Pay button disables immediately on tap, checkout form autosaves to sessionStorage so a refresh loses nothing.
8. **DB:** pooled connection string, function region next to DB region, transactions under ~50ms, indexes from the schema. Warm the DB with a request ~10 min before posting on Instagram.
9. **Double-tap safety:** client generates an idempotency key per checkout attempt. Same key = same order returned.
10. **Abuse control without Redis:** max 2 pending orders per phone, max N passes per order (config), simple per-IP limit on order creation via the host's built-in firewall/rate-limit if available.

**Capacity sanity:** 100 visitors is mostly CDN hits; maybe 30-60 order creates in the first minute, each a handful of short queries. Likely bottlenecks are DB cold start, gateway API latency, and the email provider's send cap, not CPU. Verify the current Vercel, Neon, and email limits from their official docs before launch. Do not trust remembered numbers.

---

## 2. Outage-proofing: internet, power, devices

**Principle:** the server is the source of truth, but the gate must never stop. Four layers; each still works when the one above dies.

### Layer 1: Online scan (normal)
Continuous camera scan (camera stays open between scans), result under 1s, full-screen state + sound + vibration.

| State | Meaning |
|---|---|
| GREEN | Admitted. Shows name, pass, **ADMITS n** |
| RED | Rejected, with reason: already used (time + by whom) / invalid / refunded / cancelled |
| AMBER | **No connection.** Never shown as red or green. Auto-retries |
| BLUE | Admitted in offline local mode, pending sync |

### Layer 2: Manual lookup + tap-to-admit (online)
Search by name, last 4 of phone, or short code. Result card with a big ADMIT button that calls the same atomic endpoint, logged `method='manual'`.
Every ticket carries a **short code** (e.g. `Y2K-7K3M9`, unambiguous alphabet, no 0/O/1/I) shown under the QR on the ticket page and in the email. Cracked screen, dim phone, glare: type the code.

### Layer 3: Offline Local Mode (scanner PWA)
- At doors-open each volunteer taps **Download guest list** while online. Stored in IndexedDB per ticket: `sha256(token)`, short code, name, last 4 of phone, pass, admits, status at snapshot time.
- If the network or server fails, the scanner flips to BLUE local mode: validates against the snapshot, marks used locally, queues events (each with a client-generated UUID), and **auto-syncs when the connection returns**. Name and short-code lookup also work offline.
- **Honest hole:** in local mode two phones can't see each other's scans, so one ticket could pass two gates. Mitigations: run **one entry lane or one lead device** while offline; duplicates are caught on sync (first synced wins, the other is logged `duplicate_offline` and flagged in the report). Small, bounded, accepted risk.
- **Second hole:** a ticket refunded after the snapshot. Freeze refunds at T-3h and re-download the snapshot hourly while online.
- **Snapshot privacy:** minimum fields only (no email, no full phone, no Instagram). Volunteer role only. Wiped on logout and the day after the event.

### Layer 4: Paper + backups (zero power, zero internet)
- **Printed guest list**, A-Z by name: name, short code, pass, admits, checkbox. Printed from an admin "Print list" page at T-24h and T-2h.
- CSV of the attendee list kept on two admin phones.
- **Hardware:** a power bank per volunteer phone, one portable hotspot on a *different carrier* than the venue Wi-Fi, one spare phone logged in as a volunteer.

### Attendee side
- Ticket page is a cached PWA and renders the QR **client-side from the token** (no image request), so it opens with zero signal.
- Email carries the QR as an attachment plus the short code in plain text.
- Ticket page nudges: "Screenshot this. Your short code is on it."

### Failure matrix

| Scenario | Volunteer sees | Recovery |
|---|---|---|
| Venue internet down | AMBER, then BLUE if snapshot loaded | Local mode, one lane, auto-sync later. Else paper list |
| Server/DB outage | Same as above | Same. Check status pages, don't panic |
| Volunteer phone dies | n/a | Spare phone, log in, server state intact. Local queue persisted in IndexedDB, so charge phones |
| Camera won't scan | n/a | Short code or name lookup |
| Attendee has no signal | n/a | Cached ticket / screenshot / lookup by phone last 4 |
| Attendee lost the ticket | n/a | Lookup by name/phone, verify ID matches, admit manually (logged) |
| "I paid on UPI directly" | n/a | Admin issues a comp ticket (reason required, audit logged) |
| Duplicate scan, 2 phones | RED "already used at HH:MM" for the second | Atomic UPDATE guarantees one winner |
| Same event synced twice | n/a | `client_event_id` unique, so second insert ignored |
| Admin locked out | n/a | Two admin accounts; credentials in a password manager |
| Crowd surge at gate | n/a | Fast scan path, no extra taps, more lanes |
| Phone clock wrong | n/a | Server time is authoritative; device time stored only for diagnosis |

---

## 3. Schema and contract deltas

**tickets:** add `short_code text unique not null`, `admits int not null default 1`, `used_at timestamptz`, `used_by uuid`, `source text` (`purchase` | `comp`).
**checkins:** `id`, `ticket_id`, `staff_id`, `outcome` (`admitted` | `duplicate` | `invalid` | `revoked` | `duplicate_offline`), `method` (`qr` | `manual`), `mode` (`online` | `offline_sync`), `client_event_id uuid unique`, `device_time`, `server_time`.
**email_outbox:** `id`, `order_id`, `to`, `status` (`pending` | `sent` | `failed`), `attempts`, `last_error`.
**idempotency:** `orders.idempotency_key unique`; `payments.provider_payment_id unique`.

**Atomic check-in (the whole trick):**
```sql
UPDATE tickets
SET status='used', used_at=now(), used_by=$staff
WHERE token_hash=$hash AND status='valid'
RETURNING id, attendee_name, pass_name, admits;
```
Zero rows returned means reject, and a follow-up SELECT decides the reason (already used / invalid / revoked).

**Endpoints added:**
- `POST /api/scan` `{ token | shortCode, clientEventId, method }` (volunteer+).
- `POST /api/scan/sync` batch of queued events, idempotent (volunteer+).
- `GET /api/staff/snapshot` guest-list snapshot (volunteer+, event-day window only).
- `GET /api/staff/lookup?q=` name / phone last 4 / short code (volunteer+, returns minimal fields).
- `POST /api/admin/tickets/comp`, `POST /api/admin/tickets/:id/revoke`, `GET /api/admin/print-list`, `POST /api/admin/reconcile` (admin only, audit logged).

---

## 4. Payment edge cases (do not skip)

1. **Webhook is the only confirmation.** Success page polls order status.
2. **Backup path:** if the success page polls and the order is still pending after ~10s, the server fetches the payment status from the gateway API itself and confirms if captured. Covers a missed or delayed webhook.
3. **Reservation expiry without cron:** available = `total - sold - active_reservations`, where active means pending and `expires_at > now()`. Expiry is evaluated at read time; no sweeper job. Reservation inserts lock the pass-type row (`SELECT ... FOR UPDATE`) so concurrent buyers serialize per pass type. Fine at this scale.
4. **Late payment on an expired reservation:** on webhook, try to re-reserve atomically. If stock is gone, mark `needs_refund`, show it at the top of admin, and email the buyer. Never silently drop a paid order.
5. **Paid but no ticket** is the worst bug: the Reconcile button lists gateway-captured payments with no ticket and any `needs_refund` orders.
6. **Duplicate webhooks:** unique `provider_payment_id`, so the second delivery is a no-op that still returns 200.
7. **Email failure:** ticket page is the source of truth; outbox row retries on the next webhook/ticket-page hit, and admin has a **Resend** button.
8. **Refund in gateway dashboard:** the webhook revokes the tickets; scanner rejects them.
9. **Phone normalization** to +91 E.164, Instagram handle strips `@` and URLs, email lowercased.
10. **All times stored UTC, displayed IST.**

---

## 5. Admin (functional, phone-friendly)
Counts (sold / left / checked-in), search, ticket detail, pass toggles, volunteer accounts, revoke, comp ticket, CSV export, print list, reconcile, `/admin/health` (DB ok, last webhook time, failed emails, pending orders, needs_refund). All admin routes enforce role server-side. Every sensitive action writes an audit row.

---

## 6. Code rules (copy into CLAUDE.md)
- Layout: `app/` routes only; business logic in `lib/{inventory,payments,tickets,checkin,email,auth}`; UI in `components/`; tokens in `design/tokens.css`.
- Routes are thin: validate with Zod, call a `lib` function, return `{ ok, data | error: { code, message } }`. No stack traces to users.
- Money path (`payments`, `tickets`, `inventory`, `checkin`): no change without a test; concurrency tests required.
- Raw SQL for atomic operations; no ORM-wrapped race conditions.
- Logs never contain tokens, full phones, or secrets.
- UI uses design tokens only. No ad-hoc colors, radii, or shadows.
- Every async button has loading, error, and success states.

---

## 7. Test additions
- Playwright with `context.setOffline(true)`: scanner flips to local mode, queues, syncs on reconnect.
- Two parallel scans of one token: exactly one `admitted`.
- 20 parallel reservations on 1 remaining pass: exactly one succeeds.
- Same webhook delivered 5 times: one payment, one set of tickets.
- Payment captured after reservation expiry: re-reserve or `needs_refund`, never lost.
- Offline-synced duplicate flagged as `duplicate_offline`.
- Short code typo (wrong checksum) rejected without a DB hit.
- Real-phone camera test on one iPhone (Safari) and one budget Android (Chrome), in daylight and low light.

---

## 8. Schedule impact (honest)
- Core build (payments, tickets, scanner, landing, admin): ~5h.
- Short code + manual lookup + print list + comp ticket: ~30 min. **Build these inside the core.**
- Offline Local Mode (snapshot, queue, sync): ~60-75 min. Build after the core is deployed and the payment path is verified. If time is tight, ship with paper + online manual lookup and add local mode before the event.

---

## 9. Trust pages: draft copy
Drafts only. Fill every [BRACKET] with real facts; invent nothing. Not legal advice; have one person read the refund and terms text before going live. The payment gateway usually wants Terms, Privacy, Refund/Cancellation, and Contact pages with a real business name, address, phone, and email.

### FAQ

**What is Project Y2K?**
[One or two true sentences about the party. Reference last year's party.]

**When and where?**
[Date: 15 November 2026]. [Doors open HH:MM, music until HH:MM]. [Venue name, full address, map link].

**Who can come?**
[Age limit, e.g. 18+]. Carry a valid government photo ID. Entry may be refused without it.

**How do I get my ticket?**
After payment is confirmed you'll see your ticket on screen immediately and get it by email. Your ticket has a QR code and a short code.

**I paid but don't see my ticket.**
Wait 2 minutes and refresh the page; confirmation can take a moment. Still nothing? Message us on WhatsApp at [number] with your phone number and payment screenshot. If you were charged, you will get a ticket or a refund.

**I lost my ticket / the email didn't arrive.**
Use "Find my ticket" on the website, or check your spam folder. We can also look you up at the door with your name and phone number, plus ID.

**Is the ticket transferable?**
[Yes/No. If yes, explain how.] Each QR works once. Whoever's ticket is scanned first gets in, so don't share screenshots publicly.

**What does a couple pass include?**
[One QR that admits 2 people. Both must arrive together.] Edit to match your actual pass.

**What should I wear?**
[Dress code, or "Y2K-inspired outfits encouraged"]. [Any restrictions.]

**What's not allowed?**
[Outside food/drinks, weapons, illegal substances, etc. List your real rules.]

**Can I leave and come back?**
[Re-entry policy.]

**Parking and getting home?**
[Parking info, nearest metro/landmark, cab pickup suggestions.]

**Photos and videos at the event?**
[Photography notice: attendees may appear in event photos and video used for promotion.]

**What if the event is cancelled or rescheduled?**
See the Refund Policy below.

**Who is behind this?**
Project Y2K is organised by [organiser names/business name]. Ticketing is powered by Khelo ([khel-o.com]).

### Refund & Cancellation Policy
- **Tickets are [non-refundable / refundable until DD Month 2026].** [Pick one and say it plainly.]
- **If we cancel the event:** every ticket is refunded in full to the original payment method.
- **If we reschedule:** your ticket stays valid for the new date. If you can't attend the new date, you can request a refund within [X] days of the announcement.
- **If you were charged twice or charged without receiving a ticket:** you'll get a ticket or a full refund of the extra/unfulfilled charge.
- **Timeline:** approved refunds are initiated within [X] business days and typically reach your account in [5-7] business days, depending on your bank.
- **To request a refund:** WhatsApp [number] or email [email] with your name, phone number, and order ID.
- **Fees:** [State whether the convenience fee is refunded.]
- Refunded tickets are cancelled and stop working at entry.

### Terms & Conditions
1. **Organiser.** Project Y2K is organised by [legal/business name], [address]. Ticketing is powered by Khelo.
2. **Entry.** A valid ticket and government photo ID are required. Each ticket admits the number of people stated on it, once.
3. **Right of admission.** The organiser may refuse or remove anyone who breaches the rules, behaves unsafely, or cannot show valid ID, without refund.
4. **Tickets.** Tickets are issued only after payment is verified. Duplicated, altered, or resold-for-profit tickets may be cancelled without refund.
5. **Age and conduct.** [Age limit]. Attendees follow venue rules and the law.
6. **Prohibited items.** [List.]
7. **Photography.** By attending, you consent to being photographed or filmed for event promotion, unless you tell the crew at the door.
8. **Changes.** The organiser may change timings, lineup, or venue where necessary and will announce changes through [Instagram/WhatsApp/email].
9. **Liability.** Attendees participate at their own risk. The organiser is not liable for loss of personal belongings, to the extent permitted by law.
10. **Governing law.** These terms are governed by the laws of India. Disputes are subject to the courts at [city, state].
11. **Contact.** [Email], [WhatsApp number].

### Privacy Policy
- **What we collect:** your name, phone number, email address, Instagram handle, order and payment status, and entry check-in records.
- **Why:** to sell you a ticket, deliver it, verify entry, contact you about the event, and handle refunds and support.
- **Payments:** handled by [Razorpay]. We never see or store your card, UPI PIN, or bank details.
- **Who sees it:** event organisers and authorised entry staff (who see only what they need to admit you). Our service providers (hosting, database, email, payments) process data on our behalf. We do not sell your data.
- **QR codes:** your ticket QR contains a random code only, no personal information.
- **Marketing:** we may message you about future events by [channel]. Reply STOP or email [email] to opt out. [Remove this line if you will not do marketing.]
- **Retention:** we keep ticket and order records for [X months/years] for support, accounting, and legal reasons, then delete or anonymise them.
- **Your rights:** you can ask to see, correct, or delete your data by emailing [email]. We will respond within [X] days.
- **Security:** access is role-restricted, data is encrypted in transit, and entry-staff access is limited and logged.
- **Contact:** [Name], [email].

### Contact
[Business/organiser name]
[Registered or operating address]
WhatsApp: [number] (replies within [X hours])
Email: [email]
Instagram: [@handle]
Support hours: [days/hours]
Event-day helpline: [number]

### About us (short, real names and faces)
[2-4 sentences: who you are, the last party, how many came, why you're doing it again.]
Last party: [photo wall, short clip, and real attendee reactions, with permission].
Ticketing powered by Khelo, [one line about the gaming café, linking to khel-o.com].

### Delivery note (for gateway approval)
Tickets are digital and delivered instantly on-screen after payment and by email. No physical shipping.
