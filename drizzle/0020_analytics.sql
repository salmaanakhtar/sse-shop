CREATE TYPE "public"."analytics_event_type" AS ENUM('page_view', 'product_view', 'order_placed');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "analytics_event_type" NOT NULL,
	"path" text NOT NULL,
	"product_id" text,
	"visitor_hash" text NOT NULL,
	"user_id" text,
	"order_id" text,
	"value_minor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_idx" ON "analytics_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_product_idx" ON "analytics_events" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_path_idx" ON "analytics_events" USING btree ("path","created_at");