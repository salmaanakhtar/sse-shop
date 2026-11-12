-- Backfill-safe: existing orders get a 90-day window from the migration, then
-- the default is removed so placement must set the value explicitly.
ALTER TABLE "orders" ADD COLUMN "lookup_expires_at" timestamp with time zone DEFAULT now() + interval '90 days' NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "lookup_expires_at" DROP DEFAULT;
