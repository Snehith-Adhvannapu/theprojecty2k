// Ticket tokens and codes.
//
// Token = base64url(HMAC-SHA256(AUTH_SECRET, ticketId)): 32 bytes, unguessable without the
// server secret, and re-derivable so the buyer's success page and email can show the QR
// without us ever storing the plaintext. Only sha256(token) is stored in the database,
// so a database leak alone yields nothing scannable. (Rotating AUTH_SECRET invalidates
// issued tickets: do not change it after sales start.)
import crypto from "node:crypto";
import type { Q } from "@/lib/db";

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return s;
}

export function tokenForTicket(ticketId: string): string {
  return crypto.createHmac("sha256", authSecret()).update(`ticket:${ticketId}`).digest("base64url");
}

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

// ---- Short codes -----------------------------------------------------------
// 31 symbols: no 0/O/1/I/L. Format Y2K-XXXXXC where C is a check symbol, so a typo
// is rejected without touching the database.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BODY_LEN = 5;

function checkChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * ALPHABET.indexOf(body[i]);
  return ALPHABET[sum % ALPHABET.length];
}

export function generateShortCode(): string {
  let body = "";
  for (let i = 0; i < BODY_LEN; i++) body += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `Y2K-${body}${checkChar(body)}`;
}

/** Normalises user input (case, spaces, missing hyphen). Returns null if malformed or checksum fails. */
export function parseShortCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/^Y2K/, "");
  if (s.length !== BODY_LEN + 1) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  const body = s.slice(0, BODY_LEN);
  return checkChar(body) === s[BODY_LEN] ? `Y2K-${s}` : null;
}

// ---- Issuance ----------------------------------------------------------------
export interface IssueInput {
  orderId: string | null;
  orderItemId: string | null;
  passTypeId: string;
  admits: number;
  holderName: string;
  holderPhone: string;
  holderEmail: string | null;
  holderInstagram: string | null;
  source: "purchase" | "comp";
  compReason?: string | null;
}

/** Inserts one ticket. Must run inside the caller's transaction. */
export async function issueTicket(q: Q, t: IssueInput): Promise<{ id: string; shortCode: string }> {
  const id = crypto.randomUUID();
  const tokenHash = hashToken(tokenForTicket(id));
  for (let attempt = 0; attempt < 8; attempt++) {
    const shortCode = generateShortCode();
    const rows = await q.query<{ id: string }>(
      `INSERT INTO tickets (id, order_id, order_item_id, pass_type_id, token_hash, short_code, admits,
         holder_name, holder_phone, holder_email, holder_instagram, source, comp_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (short_code) DO NOTHING RETURNING id`,
      [id, t.orderId, t.orderItemId, t.passTypeId, tokenHash, shortCode, t.admits,
        t.holderName, t.holderPhone, t.holderEmail, t.holderInstagram, t.source, t.compReason ?? null],
    );
    if (rows.length) return { id, shortCode };
  }
  throw new Error("could not allocate a unique short code");
}

/** Issues every ticket for a paid order (one per pass unit). Inside the caller's transaction. */
export async function issueTicketsForOrder(q: Q, orderId: string): Promise<number> {
  const [order] = await q.query(
    "SELECT buyer_name, buyer_phone, buyer_email, buyer_instagram, guest_instagrams FROM orders WHERE id = $1",
    [orderId],
  );
  const items = await q.query(
    `SELECT oi.id, oi.qty, oi.pass_type_id, p.admits
       FROM order_items oi JOIN pass_types p ON p.id = oi.pass_type_id WHERE oi.order_id = $1`,
    [orderId],
  );
  // Handles go to tickets in issue order: the buyer first, then the guests. A ticket carries the first handle of the people it admits; the full list stays on the order.
  const guests = Array.isArray(order.guest_instagrams) ? (order.guest_instagrams as string[]) : [];
  const handles = [order.buyer_instagram, ...guests].filter((h): h is string => !!h);
  let cursor = 0;
  let n = 0;
  for (const it of items) {
    for (let i = 0; i < it.qty; i++) {
      await issueTicket(q, {
        orderId,
        orderItemId: it.id,
        passTypeId: it.pass_type_id,
        admits: it.admits,
        holderName: order.buyer_name,
        holderPhone: order.buyer_phone,
        holderEmail: order.buyer_email,
        holderInstagram: handles[cursor] ?? order.buyer_instagram,
        source: "purchase",
      });
      cursor += it.admits;
      n++;
    }
  }
  return n;
}

export interface TicketView {
  id: string;
  shortCode: string;
  admits: number;
  status: string;
  holderName: string;
  passName: string;
  usedAt: string | null;
  token: string;
}

export async function ticketsForOrder(q: Q, orderId: string): Promise<TicketView[]> {
  const rows = await q.query(
    `SELECT t.id, t.short_code, t.admits, t.status, t.holder_name, t.used_at, p.name AS pass_name
       FROM tickets t JOIN pass_types p ON p.id = t.pass_type_id
      WHERE t.order_id = $1 ORDER BY t.created_at, t.id`,
    [orderId],
  );
  return rows.map((r) => ({
    id: r.id,
    shortCode: r.short_code,
    admits: r.admits,
    status: r.status,
    holderName: r.holder_name,
    passName: r.pass_name,
    usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
    token: tokenForTicket(r.id),
  }));
}

export async function ticketByToken(q: Q, token: string) {
  const rows = await q.query(
    `SELECT t.id, t.short_code, t.admits, t.status, t.holder_name, t.used_at, t.source, p.name AS pass_name
       FROM tickets t JOIN pass_types p ON p.id = t.pass_type_id WHERE t.token_hash = $1`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}
