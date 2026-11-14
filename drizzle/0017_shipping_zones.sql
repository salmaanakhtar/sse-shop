CREATE TABLE "shipping_bands" (
	"id" text PRIMARY KEY NOT NULL,
	"zone_id" text NOT NULL,
	"min_weight_grams" integer NOT NULL,
	"max_weight_grams" integer,
	"rate_minor" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"emirate" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"free_threshold_minor" integer DEFAULT 20000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_zones_emirate_unique" UNIQUE("emirate")
);
--> statement-breakpoint
ALTER TABLE "shipping_bands" ADD CONSTRAINT "shipping_bands_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_bands_zone_idx" ON "shipping_bands" USING btree ("zone_id","min_weight_grams");--> statement-breakpoint
CREATE INDEX "shipping_zones_active_idx" ON "shipping_zones" USING btree ("active","position");