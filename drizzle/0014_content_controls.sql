CREATE TABLE "home_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "home_sections_active_position_idx" ON "home_sections" USING btree ("active","position");--> statement-breakpoint
CREATE INDEX "pages_published_idx" ON "pages" USING btree ("published");