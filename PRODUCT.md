# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 App Router + TypeScript, Tailwind v4 wired to `design/tokens.css`, one app, local Postgres (PGlite) or any Postgres via `DATABASE_URL`. Confirmed by `CLAUDE.md`. (Written from SPEC.md, PLAN.md and CLAUDE.md rather than a fresh interview: the user asked to build immediately and said to raise doubts only up front.)

## Users

- **Buyers:** mostly 18-30, arriving from Instagram and WhatsApp on mid-range phones over 4G. One-handed, in a hurry, buying one to four passes. No account.
- **Volunteers (door staff):** scan tickets at night, crowded, dim light, phone in one hand. Need an unmistakable verdict in under a second.
- **Admins (2):** the organiser team, checking sales, fixing problems, exporting lists. Phone or laptop.

## Product Purpose

Sell about 300 tickets to one party on 15 November 2026 and get everyone in the door once. Success: payment is never falsely confirmed, nobody is oversold, nobody enters twice, and the scanner never blocks the line.

## Positioning

A party-brand site that feels like the party (chrome-noir, flash photography), whose payment, ticket and entry screens are calmer and more trustworthy than the brand around them. Ticketing is powered by Khelo.

## Operating Context

Payments through Razorpay (test mode until the account is approved). Tickets are QR plus a short code, shown on screen, emailed through Resend, recoverable via "Find my ticket". Entry uses volunteer phones with the camera; backup is name/phone/short-code lookup and a printed list.

## Capabilities and Constraints

- Pass names, prices, quantities are admin-managed, never hardcoded. A couple pass is one ticket that admits 2.
- Fee payer, refund policy, venue, doors time, age limit, dress code, organiser identity are undecided: shown as `[BRACKET]` placeholders from `config/event.ts`.
- Razorpay needs live Terms, Privacy, Refund & Cancellation and Contact pages with a real business name, address, phone and email, and a delivery note (digital tickets).
- No Redis, queues, websockets or workers. Times stored UTC, shown IST.

## Brand Commitments

Name "Project Y2K". Tokens in `design/tokens.css` and screen references in `design/reference/` are binding. Khelo placements are listed in CLAUDE.md (strip, partner block, ticket, PDF, emails; never scanner or admin).

## Evidence on Hand

No photos, clips, testimonials, attendance numbers or logo files yet. Placeholders only; never invent them.

## Product Principles

1. Money and entry screens are calm, high-contrast and unambiguous; theatre lives on the landing hero only.
2. A ticket is shown only after server-verified payment; every state says what is happening and what to do next.
3. The door never stops: amber means no connection and is never red or green.
4. Fast on a mid-range phone: CSS-only motion, static landing, lazy everything else.
5. Say nothing we cannot back up.

## Accessibility & Inclusion

Mobile first at 390px; inputs 16px; tap targets 44px minimum; honor `prefers-reduced-motion`; scanner states carry text and icon as well as colour.
