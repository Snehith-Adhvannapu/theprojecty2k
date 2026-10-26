// Inventory: available = total - sold - active unexpired reservations.
// "Active" means pending with expires_at > now(): expiry is evaluated when read,
// there is no sweeper job. Reservations lock the pass-type rows (FOR UPDATE, in id
// order to avoid deadlocks) so concurrent buyers serialise per pass type.
import { eventConfig } from "@/config/event";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { query, transaction, type Q } from "@/lib/db";

const AVAILABLE_SQL = `
  SELECT p.total_qty
    - COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE oi.pass_type_id = p.id AND o.status = 'paid'), 0)
    - COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE oi.pass_type_id = p.id AND o.status = 'pending' AND o.expires_at > now()
                   AND ($2::uuid IS NULL OR o.id <> $2::uuid)), 0)
    AS available
  FROM pass_types p WHERE p.id = $1`;

export async function availability(q: Q, passTypeId: string, excludeOrderId: string | null = null) {
  const rows = await q.query<{ available: string | number }>(AVAILABLE_SQL, [passTypeId, excludeOrderId]);
  return rows.length ? Number(rows[0].available) : 0;
}

export interface PublicPass {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  feePaise: number;
  admits: number;
  available: number;
  onSale: boolean;
}

export async function listPublicPasses(): Promise<PublicPass[]> {
  const rows = await query(
    `SELECT p.id, p.name, p.description, p.price_paise, p.fee_paise, p.admits, p.active,
            (p.sales_start IS NULL OR p.sales_start <= now()) AND (p.sales_end IS NULL OR p.sales_end >= now()) AS in_window,
            p.total_qty
              - COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                           WHERE oi.pass_type_id = p.id AND o.status = 'paid'), 0)
              - COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                           WHERE oi.pass_type_id = p.id AND o.status = 'pending' AND o.expires_at > now()), 0) AS available
       FROM pass_types p WHERE p.active = true ORDER BY p.sort, p.price_paise`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    pricePaise: r.price_paise,
    feePaise: r.fee_paise,
    admits: r.admits,
    available: Math.max(0, Number(r.available)),
    onSale: r.in_window,
  }));
}

export interface ReserveInput {
  items: { passTypeId: string; qty: number }[];
  buyer: { name: string; phone: string; email: string; instagram: string | null };
  idempotencyKey: string;
}

export interface ReservedOrder {
  id: string;
  status: string;
  amountPaise: number;
  feePaise: number;
  expiresAt: string;
  created: boolean;
}

const toReserved = (o: Record<string, never>, created: boolean): ReservedOrder => ({
  id: o["id"],
  status: o["status"],
  amountPaise: o["amount_paise"],
  feePaise: o["fee_paise"],
  expiresAt: new Date(o["expires_at"]).toISOString(),
  created,
});

export async function reserveOrder(input: ReserveInput): Promise<ReservedOrder> {
  const { holdMinutes, maxPendingPerPhone } = eventConfig.limits;

  const existing = await query("SELECT * FROM orders WHERE idempotency_key = $1", [input.idempotencyKey]);
  if (existing.length) return toReserved(existing[0] as never, false);

  // merge duplicate lines
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.passTypeId, (merged.get(it.passTypeId) ?? 0) + it.qty);
  const lines = [...merged.entries()].map(([passTypeId, qty]) => ({ passTypeId, qty })).sort((a, b) =>
    a.passTypeId.localeCompare(b.passTypeId),
  );

  try {
    return await transaction(async (q) => {
      const [event] = await q.query("SELECT id, max_per_order FROM events ORDER BY created_at LIMIT 1");
      if (!event) throw new AppError("NO_EVENT", "Ticket sales are not set up yet.", 503);
      const totalQty = lines.reduce((s, l) => s + l.qty, 0);
      if (totalQty > event.max_per_order) {
        throw new AppError("TOO_MANY", `You can buy at most ${event.max_per_order} passes per order.`);
      }

      const pending = await q.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM orders WHERE buyer_phone = $1 AND status = 'pending' AND expires_at > now()`,
        [input.buyer.phone],
      );
      if (pending[0].n >= maxPendingPerPhone) {
        throw new AppError("TOO_MANY_PENDING", "You already have unpaid orders on hold. Finish those or wait a few minutes.", 429);
      }

      // Serialise buyers per pass type.
      const passes = await q.query(
        `SELECT id, name, price_paise, fee_paise, active,
                (sales_start IS NULL OR sales_start <= now()) AND (sales_end IS NULL OR sales_end >= now()) AS in_window
           FROM pass_types WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        [lines.map((l) => l.passTypeId)],
      );
      const byId = new Map(passes.map((p) => [p.id as string, p]));

      let amount = 0;
      let fee = 0;
      for (const l of lines) {
        const p = byId.get(l.passTypeId);
        if (!p || !p.active) throw new AppError("PASS_UNAVAILABLE", "That pass is not available.", 409);
        if (!p.in_window) throw new AppError("NOT_ON_SALE", `${p.name} is not on sale right now.`, 409);
        const left = await availability(q, l.passTypeId);
        if (left < l.qty) {
          throw new AppError(
            "SOLD_OUT",
            left <= 0 ? `${p.name} is sold out.` : `Only ${left} ${p.name} left.`,
            409,
          );
        }
        amount += l.qty * (p.price_paise + p.fee_paise);
        fee += l.qty * p.fee_paise;
      }

      const [order] = await q.query(
        `INSERT INTO orders (event_id, buyer_name, buyer_phone, buyer_email, buyer_instagram,
                             idempotency_key, amount_paise, fee_paise, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + make_interval(mins => $9)) RETURNING *`,
        [event.id, input.buyer.name, input.buyer.phone, input.buyer.email, input.buyer.instagram,
          input.idempotencyKey, amount, fee, holdMinutes],
      );
      for (const l of lines) {
        const p = byId.get(l.passTypeId)!;
        await q.query(
          `INSERT INTO order_items (order_id, pass_type_id, qty, unit_price_paise, unit_fee_paise)
           VALUES ($1,$2,$3,$4,$5)`,
          [order.id, l.passTypeId, l.qty, p.price_paise, p.fee_paise],
        );
      }
      return toReserved(order as never, true);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await query("SELECT * FROM orders WHERE idempotency_key = $1", [input.idempotencyKey]);
      if (again.length) return toReserved(again[0] as never, false);
    }
    throw e;
  }
}
