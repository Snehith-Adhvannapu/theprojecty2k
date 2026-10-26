// Drizzle schema: source of truth for migrations (npm run db:generate).
// All access at runtime is parameterised raw SQL through lib/db, so atomic
// operations stay explicit. Times are timestamptz (UTC); money is integer paise.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const events = pgTable("events", {
  id: id(),
  name: text("name").notNull(),
  startsAt: ts("starts_at").notNull(),
  maxPerOrder: integer("max_per_order").notNull().default(4),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const passTypes = pgTable(
  "pass_types",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    pricePaise: integer("price_paise").notNull(),
    feePaise: integer("fee_paise").notNull().default(0),
    totalQty: integer("total_qty").notNull(),
    admits: integer("admits").notNull().default(1),
    salesStart: ts("sales_start"),
    salesEnd: ts("sales_end"),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    check("pass_total_nonneg", sql`${t.totalQty} >= 0`),
    check("pass_admits_pos", sql`${t.admits} >= 1`),
    check("pass_price_nonneg", sql`${t.pricePaise} >= 0 and ${t.feePaise} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id),
    // pending | paid | failed | needs_refund | refunded  (expiry is read-time, never a status)
    status: text("status").notNull().default("pending"),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerInstagram: text("buyer_instagram"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    amountPaise: integer("amount_paise").notNull(),
    feePaise: integer("fee_paise").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    paidAt: ts("paid_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_phone_idx").on(t.buyerPhone),
    index("orders_email_idx").on(t.buyerEmail),
    index("orders_status_expires_idx").on(t.status, t.expiresAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    passTypeId: uuid("pass_type_id").notNull().references(() => passTypes.id),
    qty: integer("qty").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    unitFeePaise: integer("unit_fee_paise").notNull().default(0),
  },
  (t) => [
    check("item_qty_pos", sql`${t.qty} > 0`),
    index("order_items_pass_idx").on(t.passTypeId),
    index("order_items_order_idx").on(t.orderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    provider: text("provider").notNull(), // razorpay | fake
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerPaymentId: text("provider_payment_id").unique(), // duplicate processing guard
    status: text("status").notNull().default("created"), // created | captured | failed | refunded
    amountPaise: integer("amount_paise").notNull(),
    feePaise: integer("fee_paise"),
    createdAt: ts("created_at").notNull().defaultNow(),
    capturedAt: ts("captured_at"),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const webhookEvents = pgTable("webhook_events", {
  providerEventId: text("provider_event_id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    orderId: uuid("order_id").references(() => orders.id), // null for comp tickets
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    passTypeId: uuid("pass_type_id").notNull().references(() => passTypes.id),
    tokenHash: text("token_hash").notNull().unique(),
    shortCode: text("short_code").notNull().unique(),
    admits: integer("admits").notNull().default(1),
    status: text("status").notNull().default("valid"), // valid | used | revoked
    holderName: text("holder_name").notNull(),
    holderPhone: text("holder_phone").notNull(),
    holderEmail: text("holder_email"),
    holderInstagram: text("holder_instagram"),
    usedAt: ts("used_at"),
    usedBy: uuid("used_by"),
    source: text("source").notNull().default("purchase"), // purchase | comp
    compReason: text("comp_reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tickets_order_idx").on(t.orderId),
    index("tickets_status_idx").on(t.status),
    index("tickets_phone_idx").on(t.holderPhone),
    index("tickets_name_idx").on(t.holderName),
  ],
);

export const staffUsers = pgTable("staff_users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // admin | volunteer
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: ts("locked_until"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const checkins = pgTable(
  "checkins",
  {
    id: id(),
    ticketId: uuid("ticket_id").references(() => tickets.id), // null when the code matched nothing
    staffId: uuid("staff_id").notNull().references(() => staffUsers.id),
    outcome: text("outcome").notNull(), // admitted | duplicate | invalid | revoked | duplicate_offline
    method: text("method").notNull(), // qr | manual
    mode: text("mode").notNull().default("online"), // online | offline_sync
    clientEventId: uuid("client_event_id").unique(),
    deviceTime: ts("device_time"),
    serverTime: ts("server_time").notNull().defaultNow(),
  },
  (t) => [index("checkins_ticket_idx").on(t.ticketId)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  staffId: uuid("staff_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    target: text("target"),
    meta: jsonb("meta"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    orderId: uuid("order_id").references(() => orders.id),
    toEmail: text("to_email").notNull(),
    kind: text("kind").notNull().default("ticket"), // ticket | find | needs_refund
    status: text("status").notNull().default("pending"), // pending | sent | failed
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [index("outbox_status_idx").on(t.status)],
);
