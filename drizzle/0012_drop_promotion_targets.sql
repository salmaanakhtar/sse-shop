DROP INDEX "promotions_target_idx";--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN "target_type";--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN "target_id";