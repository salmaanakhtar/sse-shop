CREATE TABLE "promotion_row_products" (
	"row_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "promotion_row_products_row_id_product_id_pk" PRIMARY KEY("row_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "promotion_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"promotion_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"category_id" text,
	"collection_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "promotion_row_products" ADD CONSTRAINT "promotion_row_products_row_id_promotion_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."promotion_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_row_products" ADD CONSTRAINT "promotion_row_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rows" ADD CONSTRAINT "promotion_rows_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rows" ADD CONSTRAINT "promotion_rows_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rows" ADD CONSTRAINT "promotion_rows_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_row_products_product_id_idx" ON "promotion_row_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "promotion_rows_promotion_id_idx" ON "promotion_rows" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "promotion_rows_category_id_idx" ON "promotion_rows" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "promotion_rows_collection_id_idx" ON "promotion_rows" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_rows_category_uq" ON "promotion_rows" USING btree ("promotion_id","category_id") WHERE "promotion_rows"."kind" = 'category' and "promotion_rows"."category_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_rows_collection_uq" ON "promotion_rows" USING btree ("promotion_id","collection_id") WHERE "promotion_rows"."kind" = 'collection' and "promotion_rows"."collection_id" is not null;--> statement-breakpoint
WITH ranked AS (
	SELECT
		id,
		COALESCE(
			NULLIF(
				TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF(headline, ''), 'promotion')), '[^a-z0-9]+', '-', 'g')),
				''
			),
			'promotion'
		) AS base,
		ROW_NUMBER() OVER (
			PARTITION BY COALESCE(
				NULLIF(
					TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF(headline, ''), 'promotion')), '[^a-z0-9]+', '-', 'g')),
					''
				),
				'promotion'
			)
			ORDER BY created_at, id
		) AS rn
	FROM "promotions"
)
UPDATE "promotions"
SET "slug" = CASE
	WHEN ranked.rn = 1 THEN ranked.base
	ELSE ranked.base || '-' || ranked.rn
END
FROM ranked
WHERE "promotions"."id" = ranked.id;--> statement-breakpoint
ALTER TABLE "promotions" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_slug_unique" UNIQUE("slug");--> statement-breakpoint
INSERT INTO "promotion_rows" ("id", "promotion_id", "kind", "title", "category_id", "position")
SELECT gen_random_uuid()::text, p."id", 'category', c."name", c."id", 0
FROM "promotions" p
INNER JOIN "categories" c ON c."id" = p."target_id"
WHERE p."target_type" = 'category';--> statement-breakpoint
INSERT INTO "promotion_rows" ("id", "promotion_id", "kind", "title", "collection_id", "position")
SELECT gen_random_uuid()::text, p."id", 'collection', c."name", c."id", 0
FROM "promotions" p
INNER JOIN "collections" c ON c."id" = p."target_id"
WHERE p."target_type" = 'collection';--> statement-breakpoint
WITH inserted AS (
	INSERT INTO "promotion_rows" ("id", "promotion_id", "kind", "title", "position")
	SELECT gen_random_uuid()::text, p."id", 'products', 'Featured', 0
	FROM "promotions" p
	INNER JOIN "products" pr ON pr."id" = p."target_id"
	WHERE p."target_type" = 'product'
	RETURNING "id", "promotion_id"
)
INSERT INTO "promotion_row_products" ("row_id", "product_id", "position")
SELECT inserted."id", p."target_id", 0
FROM inserted
INNER JOIN "promotions" p ON p."id" = inserted."promotion_id";
