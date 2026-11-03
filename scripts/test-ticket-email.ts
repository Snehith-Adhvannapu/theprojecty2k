// Sends one real-looking ticket email through the configured provider, using whatever DATABASE_URL points at.
// Meant for a scratch database (the server's local Postgres), never the live one. Usage: tsx scripts/test-ticket-email.ts you@example.com
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), false);

(async () => {
  const to = process.argv[2];
  if (!to) throw new Error("usage: test-ticket-email.ts <email>");
  const { query, transaction } = await import("../lib/db");
  const { issueTicketsForOrder } = await import("../lib/tickets");
  const { flushOutbox } = await import("../lib/email");

  const [ev] = await query("INSERT INTO events (name, starts_at) VALUES ('Project Y2K', '2026-11-15T06:30:00Z') RETURNING id");
  const [pass] = await query(
    "INSERT INTO pass_types (event_id, name, description, price_paise, total_qty, admits) VALUES ($1,'Early Bird Pass','test',149900,10,1) RETURNING id",
    [ev.id],
  );
  const [order] = await query(
    `INSERT INTO orders (event_id, status, buyer_name, buyer_phone, buyer_email, idempotency_key, amount_paise, expires_at, paid_at)
     VALUES ($1,'paid','Test Guest','+919999999999',$2,$3,149900, now() + interval '1 day', now()) RETURNING id`,
    [ev.id, to, `test-${Date.now()}`],
  );
  await query("INSERT INTO order_items (order_id, pass_type_id, qty, unit_price_paise) VALUES ($1,$2,1,149900)", [order.id, pass.id]);
  await transaction((q) => issueTicketsForOrder(q, order.id));
  await query("INSERT INTO email_outbox (order_id, to_email, kind) VALUES ($1,$2,'ticket')", [order.id, to]);
  await flushOutbox(order.id);
  const [row] = await query("SELECT status, attempts, last_error FROM email_outbox WHERE order_id = $1", [order.id]);
  console.log("outbox:", JSON.stringify(row));
  process.exit(row.status === "sent" ? 0 : 1);
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
