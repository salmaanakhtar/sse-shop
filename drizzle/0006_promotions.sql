CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"subheadline" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT 'Shop now' NOT NULL,
	"href" text NOT NULL,
	"image_key" text NOT NULL,
	"image_alt" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "promotions_active_position_idx" ON "promotions" USING btree ("active","position");