CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_reviews_product_user_uq" ON "product_reviews" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "product_reviews_product_status_idx" ON "product_reviews" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "product_reviews_status_created_idx" ON "product_reviews" USING btree ("status","created_at");