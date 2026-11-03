CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id"),
	"amount_paise" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"refunded_by" uuid,
	"refunded_at" timestamp with time zone DEFAULT now() NOT NULL
);
