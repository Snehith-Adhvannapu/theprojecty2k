CREATE TABLE IF NOT EXISTS "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"visitor" text NOT NULL,
	"country" text,
	"city" text,
	"device" text,
	"browser" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_at_idx" ON "page_views" ("at");
