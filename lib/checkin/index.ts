// Entry. One conditional UPDATE decides admit vs reject: two phones scanning one
// ticket at the same instant can never both win. A follow-up SELECT only explains a rejection.
import { query } from "@/lib/db";
import { hashToken, parseShortCode } from "@/lib/tickets";
import { last4 } from "@/lib/normalize";

export type Outcome = "admitted" | "duplicate" | "invalid" | "revoked";

export interface ScanResult {
  outcome: Outcome;
  reason?: "bad_code" | "not_found" | "already_used" | "revoked";
  ticket?: {
    id: string;
    name: string;
    passName: string;
    admits: number;
    shortCode: string;
    usedAt?: string;
    usedBy?: string;
  };
}

export interface ScanInput {
  token?: string;
  shortCode?: string;
  staffId: string;
  method: "qr" | "manual";
  clientEventId?: string;
}

const TICKET_COLS = `t.id, t.holder_name, t.admits, t.short_code, t.status, t.used_at, p.name AS pass_name,
                     (SELECT s.name FROM staff_users s WHERE s.id = t.used_by) AS used_by_name`;

const view = (r: Record<string, never>, withUsed = false): NonNullable<ScanResult["ticket"]> => ({
  id: r["id"],
  name: r["holder_name"],
  passName: r["pass_name"],
  admits: r["admits"],
  shortCode: r["short_code"],
  ...(withUsed && r["used_at"]
    ? { usedAt: new Date(r["used_at"]).toISOString(), usedBy: r["used_by_name"] ?? undefined }
    : {}),
});

export async function checkIn(input: ScanInput): Promise<ScanResult> {
  // Same client event twice (network retry): replay the first answer, never re-decide.
  if (input.clientEventId) {
    const prior = await query(
      `SELECT c.outcome, ${TICKET_COLS}
         FROM checkins c LEFT JOIN tickets t ON t.id = c.ticket_id LEFT JOIN pass_types p ON p.id = t.pass_type_id
        WHERE c.client_event_id = $1`,
      [input.clientEventId],
    );
    if (prior.length) {
      const r = prior[0];
      return { outcome: r.outcome as Outcome, ticket: r.id ? view(r as never, r.outcome !== "admitted") : undefined };
    }
  }

  let where: string;
  let key: string;
  if (input.token) {
    where = "t.token_hash = $1";
    key = hashToken(input.token);
  } else if (input.shortCode) {
    const code = parseShortCode(input.shortCode);
    if (!code) return { outcome: "invalid", reason: "bad_code" }; // checksum typo: no DB hit
    where = "t.short_code = $1";
    key = code;
  } else {
    return { outcome: "invalid", reason: "bad_code" };
  }

  // THE atomic statement.
  const won = await query(
    `WITH u AS (
       UPDATE tickets t SET status = 'used', used_at = now(), used_by = $2
        WHERE ${where} AND t.status = 'valid'
       RETURNING t.id, t.holder_name, t.admits, t.short_code, t.pass_type_id, t.status, t.used_at, t.used_by
     )
     SELECT u.id, u.holder_name, u.admits, u.short_code, u.status, u.used_at, p.name AS pass_name, NULL AS used_by_name
       FROM u JOIN pass_types p ON p.id = u.pass_type_id`,
    [key, input.staffId],
  );

  let result: ScanResult;
  if (won.length) {
    result = { outcome: "admitted", ticket: view(won[0] as never) };
  } else {
    const why = await query(
      `SELECT ${TICKET_COLS} FROM tickets t JOIN pass_types p ON p.id = t.pass_type_id WHERE ${where}`,
      [key],
    );
    if (!why.length) result = { outcome: "invalid", reason: "not_found" };
    else if (why[0].status === "revoked") result = { outcome: "revoked", reason: "revoked", ticket: view(why[0] as never) };
    else result = { outcome: "duplicate", reason: "already_used", ticket: view(why[0] as never, true) };
  }

  await query(
    `INSERT INTO checkins (ticket_id, staff_id, outcome, method, client_event_id)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (client_event_id) DO NOTHING`,
    [result.ticket?.id ?? null, input.staffId, result.outcome, input.method, input.clientEventId ?? null],
  );
  return result;
}

export interface LookupRow {
  id: string;
  name: string;
  passName: string;
  admits: number;
  shortCode: string;
  status: string;
  phoneLast4: string;
  usedAt: string | null;
}

/** Volunteer-safe search: name, last 4 of phone, or short code. Minimal fields only. */
export async function lookupGuests(q: string): Promise<LookupRow[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const code = parseShortCode(term);
  const alnum = term.replace(/[^A-Za-z0-9]/g, "");
  const nameLike = term.replace(/[%_\\]/g, "");
  if (alnum.length < 2 || nameLike.length < 2) return [];
  const rows = await query(
    `SELECT t.id, t.holder_name, t.admits, t.short_code, t.status, t.holder_phone, t.used_at, p.name AS pass_name
       FROM tickets t JOIN pass_types p ON p.id = t.pass_type_id
      WHERE t.holder_name ILIKE $1
         OR t.holder_email ILIKE $1
         OR t.holder_instagram ILIKE $1
         OR ($2 <> '' AND length($2) = 4 AND right(t.holder_phone, 4) = $2)
         OR ($3::text IS NOT NULL AND t.short_code = $3)
         OR t.short_code ILIKE $4
      ORDER BY t.holder_name LIMIT 20`,
    [`%${nameLike}%`, digits, code, `%${alnum}%`],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.holder_name,
    passName: r.pass_name,
    admits: r.admits,
    shortCode: r.short_code,
    status: r.status,
    phoneLast4: last4(r.holder_phone),
    usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
  }));
}
