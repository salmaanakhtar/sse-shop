UPDATE "promotions"
SET "target_type" = 'product', "target_id" = "products"."id"
FROM "products"
WHERE "promotions"."href" = '/products/' || "products"."slug";--> statement-breakpoint
UPDATE "promotions"
SET "target_type" = 'category', "target_id" = "categories"."id"
FROM "categories"
WHERE "promotions"."target_id" IS NULL
  AND "promotions"."href" = '/category/' || "categories"."slug";--> statement-breakpoint
UPDATE "promotions"
SET "target_type" = 'collection', "target_id" = "collections"."id"
FROM "collections"
WHERE "promotions"."target_id" IS NULL
  AND "promotions"."href" = '/collections/' || "collections"."slug";--> statement-breakpoint
UPDATE "promotions" SET "active" = false WHERE "target_id" IS NULL;--> statement-breakpoint
ALTER TABLE "promotions" DROP COLUMN "href";
