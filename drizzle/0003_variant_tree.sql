CREATE TABLE "variant_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"parent_id" text,
	"option_id" text,
	"option_value_id" text,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"image_key" text,
	"image_alt" text DEFAULT '' NOT NULL,
	"default_price_minor" integer,
	"default_stock_qty" integer,
	"variant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_nodes" ADD CONSTRAINT "variant_nodes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_nodes" ADD CONSTRAINT "variant_nodes_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_nodes" ADD CONSTRAINT "variant_nodes_option_value_id_product_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_nodes" ADD CONSTRAINT "variant_nodes_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_nodes" ADD CONSTRAINT "variant_nodes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."variant_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variant_nodes_product_id_idx" ON "variant_nodes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variant_nodes_parent_id_idx" ON "variant_nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_nodes_variant_id_uq" ON "variant_nodes" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_nodes_root_uq" ON "variant_nodes" USING btree ("product_id","option_id","option_value_id") WHERE "variant_nodes"."parent_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_nodes_default_uq" ON "variant_nodes" USING btree ("product_id") WHERE "variant_nodes"."parent_id" is null and "variant_nodes"."option_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_nodes_child_uq" ON "variant_nodes" USING btree ("parent_id","option_value_id") WHERE "variant_nodes"."parent_id" is not null;--> statement-breakpoint

-- Backfill a tree from the old Cartesian joins. Each existing variant becomes
-- a leaf; shared path prefixes become parent nodes. Parent nodes stay active,
-- while each leaf inherits the variant's active flag.
CREATE OR REPLACE FUNCTION variant_tree_migration_id() RETURNS text AS $$
SELECT
  lpad(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0') || '-' ||
  '7' || substr(md5(random()::text), 1, 3) || '-' ||
  '8' || substr(md5(random()::text), 1, 3) || '-' ||
  substr(md5(random()::text), 1, 4) || '-' ||
  substr(md5(random()::text), 1, 12);
$$ LANGUAGE SQL VOLATILE;--> statement-breakpoint

DO $$
DECLARE
  v RECORD;
  val RECORD;
  current_parent TEXT;
  node_id TEXT;
BEGIN
  FOR v IN SELECT id, product_id, active FROM variants LOOP
    current_parent := NULL;

    FOR val IN
      SELECT
        pov.id AS value_id,
        pov.value,
        pov.position AS value_position,
        po.id AS option_id,
        po.position AS option_position
      FROM variant_option_values vov
      JOIN product_option_values pov ON pov.id = vov.option_value_id
      JOIN product_options po ON po.id = vov.option_id
      WHERE vov.variant_id = v.id
      ORDER BY po.position, pov.position
    LOOP
      node_id := NULL;

      IF current_parent IS NULL THEN
        SELECT id INTO node_id
        FROM variant_nodes
        WHERE product_id = v.product_id
          AND parent_id IS NULL
          AND option_value_id = val.value_id
        LIMIT 1;
      ELSE
        SELECT id INTO node_id
        FROM variant_nodes
        WHERE parent_id = current_parent
          AND option_value_id = val.value_id
        LIMIT 1;
      END IF;

      IF node_id IS NULL THEN
        node_id := variant_tree_migration_id();
        INSERT INTO variant_nodes
          (id, product_id, parent_id, option_id, option_value_id, label, position, active)
        VALUES
          (node_id, v.product_id, current_parent, val.option_id, val.value_id, val.value, val.value_position, true);
      END IF;

      current_parent := node_id;
    END LOOP;

    IF current_parent IS NULL THEN
      SELECT id INTO node_id
      FROM variant_nodes
      WHERE product_id = v.product_id
        AND parent_id IS NULL
        AND option_id IS NULL
      LIMIT 1;

      IF node_id IS NULL THEN
        node_id := variant_tree_migration_id();
        INSERT INTO variant_nodes
          (id, product_id, parent_id, option_id, option_value_id, label, position, active)
        VALUES
          (node_id, v.product_id, NULL, NULL, NULL, 'Default', 0, true);
      END IF;

      current_parent := node_id;
    END IF;

    UPDATE variant_nodes
    SET variant_id = v.id, active = v.active
    WHERE id = current_parent;
  END LOOP;
END $$;--> statement-breakpoint

DROP FUNCTION variant_tree_migration_id();