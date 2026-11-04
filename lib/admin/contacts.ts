// Everyone who entered their details at checkout (not only paid buyers): the list admins message and export.
import { query } from "@/lib/db";

export interface Contact {
  orderId: string; name: string; phone: string; email: string; instagram: string | null; guests: string[];
  status: string; statusLabel: string; pass: string; qty: number; amountPaise: number; at: string;
}

export const STATUS_FILTERS = ["all", "paid", "review", "unpaid", "problem"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const LABEL: Record<string, string> = {
  paid: "Paid", awaiting_review: "In review", pending: "Not paid yet", rejected: "Rejected", needs_refund: "Refund needed", refunded: "Refunded",
};
const GROUP: Record<StatusFilter, string[] | null> = {
  all: null, paid: ["paid"], review: ["awaiting_review"], unpaid: ["pending"], problem: ["rejected", "needs_refund", "refunded"],
};

/** unique=true keeps one row per phone number: the order furthest along (paid first), then the newest. */
export async function listContacts(opts: { q?: string; status?: StatusFilter; unique?: boolean } = {}): Promise<Contact[]> {
  const term = (opts.q ?? "").trim().replace(/[%_\\]/g, "").slice(0, 80);
  const statuses = GROUP[opts.status ?? "all"];
  const params: unknown[] = [];
  const where: string[] = [];
  if (statuses) { params.push(statuses); where.push(`o.status = ANY($${params.length})`); }
  if (term) {
    params.push(`%${term}%`);
    const n = params.length;
    where.push(`(o.buyer_name ILIKE $${n} OR o.buyer_phone ILIKE $${n} OR o.buyer_email ILIKE $${n} OR o.buyer_instagram ILIKE $${n})`);
  }
  const rank = `CASE o.status WHEN 'paid' THEN 0 WHEN 'awaiting_review' THEN 1 WHEN 'needs_refund' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END`;
  const sql = `
    SELECT ${opts.unique ? "DISTINCT ON (o.buyer_phone)" : ""} o.id, o.buyer_name, o.buyer_phone, o.buyer_email, o.buyer_instagram, o.guest_instagrams, o.status, o.amount_paise, o.created_at, (o.expires_at <= now()) AS expired,
           (SELECT string_agg(p.name, ', ') FROM order_items oi JOIN pass_types p ON p.id = oi.pass_type_id WHERE oi.order_id = o.id) AS pass,
           (SELECT coalesce(sum(oi.qty), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS qty
      FROM orders o ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY ${opts.unique ? `o.buyer_phone, ${rank}, o.created_at DESC` : "o.created_at DESC"}`;
  const rows = await query(sql, params);
  const out = rows.map((r) => ({
    orderId: r.id as string, name: r.buyer_name as string, phone: r.buyer_phone as string, email: r.buyer_email as string,
    instagram: (r.buyer_instagram ?? null) as string | null,
    guests: (Array.isArray(r.guest_instagrams) ? r.guest_instagrams : []) as string[], status: r.status as string, statusLabel: r.status === "pending" && r.expired ? "Hold expired, seats released" : LABEL[r.status as string] ?? (r.status as string),
    pass: (r.pass ?? "") as string, qty: r.qty as number, amountPaise: r.amount_paise as number, at: new Date(r.created_at).toISOString(),
  }));
  return opts.unique ? out.sort((a, b) => b.at.localeCompare(a.at)) : out;
}

/** Recent staff actions. The hidden superadmin's own actions are only shown to the superadmin. */
export async function activityLog(viewerRole: string, limit = 300) {
  const hide = viewerRole === "superadmin" ? "" : "WHERE s.role IS DISTINCT FROM 'superadmin'";
  const rows = await query(
    `SELECT a.at, a.action, a.target, a.meta, s.name AS who FROM audit_logs a LEFT JOIN staff_users s ON s.id = a.actor_id ${hide}
      ORDER BY a.at DESC LIMIT $1`,
    [limit],
  );
  const SAFE = new Set(["format", "role", "reason", "name", "price", "total", "active", "checked", "recovered", "amountPaise", "amount"]);
  return rows.map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    const detail = Object.entries(meta).filter(([k]) => SAFE.has(k)).map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`).join(", ");
    return { at: new Date(r.at).toISOString(), action: r.action as string, who: (r.who ?? "system") as string, target: r.target ? String(r.target).slice(0, 8) : "", detail };
  });
}
