CREATE TABLE "wishlist_alerts" (
	"user_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_alerts_user_id_variant_id_pk" PRIMARY KEY("user_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"wishlist_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"added_price_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_wishlist_id_variant_id_pk" PRIMARY KEY("wishlist_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme_preference" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "wishlist_alerts" ADD CONSTRAINT "wishlist_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_alerts" ADD CONSTRAINT "wishlist_alerts_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishlist_alerts_variant_id_idx" ON "wishlist_alerts" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "wishlist_items_variant_id_idx" ON "wishlist_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "wishlists_user_id_idx" ON "wishlists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_default_uq" ON "wishlists" USING btree ("user_id") WHERE "wishlists"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_user_name_uq" ON "wishlists" USING btree ("user_id","name");