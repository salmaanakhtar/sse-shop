CREATE TABLE "customer_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"emirate" text NOT NULL,
	"street" text NOT NULL,
	"building" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"po_box" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_default_shipping" boolean DEFAULT false NOT NULL,
	"is_default_billing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_addresses_user_id_idx" ON "customer_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_default_shipping_uq" ON "customer_addresses" USING btree ("user_id") WHERE "customer_addresses"."is_default_shipping";--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_default_billing_uq" ON "customer_addresses" USING btree ("user_id") WHERE "customer_addresses"."is_default_billing";--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");