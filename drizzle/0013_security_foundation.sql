CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "numeral_style" text DEFAULT 'latin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_consent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits" USING btree ("expires_at");