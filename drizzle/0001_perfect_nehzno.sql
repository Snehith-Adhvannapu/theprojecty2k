ALTER TABLE "orders" ADD COLUMN "utr" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "proof_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "proof_data" "bytea";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "proof_mime" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "review_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_utr_unique" ON "orders" USING btree ("utr") WHERE "orders"."utr" is not null and "orders"."status" <> 'rejected';