ALTER TABLE "variants" ADD COLUMN "sale_price_minor" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "sale_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "sale_ends_at" timestamp with time zone;