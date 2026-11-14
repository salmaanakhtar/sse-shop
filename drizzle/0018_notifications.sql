CREATE TABLE "abandoned_cart_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abandoned_cart_emails_cart_id_unique" UNIQUE("cart_id")
);
--> statement-breakpoint
CREATE TABLE "low_stock_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"stock_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "low_stock_alerts_variant_id_unique" UNIQUE("variant_id")
);
--> statement-breakpoint
CREATE TABLE "stock_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "abandoned_cart_emails" ADD CONSTRAINT "abandoned_cart_emails_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_cart_emails" ADD CONSTRAINT "abandoned_cart_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "low_stock_alerts_created_at_idx" ON "low_stock_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_alerts_variant_email_uq" ON "stock_alerts" USING btree ("variant_id","email");--> statement-breakpoint
CREATE INDEX "stock_alerts_pending_idx" ON "stock_alerts" USING btree ("variant_id","notified_at");