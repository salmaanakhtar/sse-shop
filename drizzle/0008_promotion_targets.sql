ALTER TABLE "promotions" ADD COLUMN "target_type" text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "target_id" text;--> statement-breakpoint
CREATE INDEX "promotions_target_idx" ON "promotions" USING btree ("target_type","target_id");