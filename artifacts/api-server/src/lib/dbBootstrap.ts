import { pool } from "@workspace/db";

let databaseSchemaReady: Promise<void> | null = null;

function enumValues(values: string[]): string {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

async function createEnum(name: string, values: string[]): Promise<void> {
  await pool.query(`
    DO $$
    BEGIN
      CREATE TYPE "${name}" AS ENUM (${enumValues(values)});
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;
  `);
}

export function ensureDatabaseSchema(): Promise<void> {
  databaseSchemaReady ??= (async () => {
    await createEnum("card_status", [
      "collection",
      "for_sale",
      "sold",
      "wishlist",
      "trade_binder",
      "grading_pile",
    ]);
    await createEnum("sealed_product_type", [
      "ETB",
      "booster_box",
      "booster_pack",
      "tin",
      "binder",
      "case",
      "other",
    ]);
    await createEnum("image_label", [
      "front",
      "back",
      "damage",
      "receipt",
      "sealed",
      "other",
    ]);
    await createEnum("expense_category", [
      "supplies",
      "shipping",
      "platform_fees",
      "gas",
      "packaging",
      "grading",
      "purchase",
      "other",
    ]);
    await createEnum("pickup_status", [
      "scheduled",
      "completed",
      "cancelled",
      "no_show",
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY,
        "email" varchar UNIQUE,
        "first_name" varchar,
        "last_name" varchar,
        "profile_image_url" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar PRIMARY KEY,
        "sess" jsonb NOT NULL,
        "expire" timestamp NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "cards" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "set" text NOT NULL,
        "card_number" text,
        "rarity" text,
        "condition" text,
        "grade" text,
        "grader" text,
        "quantity" integer NOT NULL DEFAULT 1,
        "purchase_price" numeric(10, 2),
        "market_value" numeric(10, 2),
        "asking_price" numeric(10, 2),
        "sold_price" numeric(10, 2),
        "sold_date" date,
        "purchase_date" date,
        "purchase_source" text,
        "trade_notes" text,
        "status" "card_status" NOT NULL DEFAULT 'collection',
        "location" text,
        "notes" text,
        "cover_image_path" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp
      );

      CREATE TABLE IF NOT EXISTS "sealed_products" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "product_type" "sealed_product_type" NOT NULL DEFAULT 'other',
        "set" text,
        "quantity" integer NOT NULL DEFAULT 1,
        "condition" text,
        "purchase_price" numeric(10, 2),
        "market_value" numeric(10, 2),
        "asking_price" numeric(10, 2),
        "sold_price" numeric(10, 2),
        "sold_date" date,
        "purchase_date" date,
        "purchase_source" text,
        "trade_notes" text,
        "status" "card_status" NOT NULL DEFAULT 'collection',
        "location" text,
        "notes" text,
        "cover_image_path" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp
      );

      CREATE TABLE IF NOT EXISTS "item_images" (
        "id" serial PRIMARY KEY,
        "card_id" integer,
        "sealed_product_id" integer,
        "object_path" text NOT NULL,
        "label" "image_label" NOT NULL DEFAULT 'other',
        "caption" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "card_set_totals" (
        "id" serial PRIMARY KEY,
        "set_name" text NOT NULL,
        "total_cards" integer NOT NULL DEFAULT 0,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" serial PRIMARY KEY,
        "category" "expense_category" NOT NULL DEFAULT 'other',
        "description" text NOT NULL,
        "amount" numeric(10, 2) NOT NULL,
        "date" date NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "customers" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "phone" text,
        "email" text,
        "preferences" text,
        "notes" text,
        "follow_up_date" date,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "local_pickups" (
        "id" serial PRIMARY KEY,
        "buyer_name" text NOT NULL,
        "customer_id" integer,
        "location" text,
        "meeting_datetime" timestamp,
        "item_description" text,
        "amount_due" numeric(10, 2),
        "amount_paid" numeric(10, 2),
        "status" "pickup_status" NOT NULL DEFAULT 'scheduled',
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "price_snapshots" (
        "id" serial PRIMARY KEY,
        "card_id" integer REFERENCES "cards"("id") ON DELETE CASCADE,
        "sealed_product_id" integer REFERENCES "sealed_products"("id") ON DELETE CASCADE,
        "market_value" numeric(10, 2) NOT NULL,
        "source" text NOT NULL DEFAULT 'manual',
        "snapshot_date" date NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "collection_value_history" (
        "id" serial PRIMARY KEY,
        "snapshot_date" date NOT NULL,
        "total_value" numeric(12, 2) NOT NULL,
        "cards_value" numeric(12, 2) NOT NULL,
        "sealed_value" numeric(12, 2) NOT NULL,
        "item_count" integer NOT NULL,
        "card_count" integer NOT NULL,
        "sealed_count" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");
      CREATE INDEX IF NOT EXISTS "cards_name_idx" ON "cards" ("name");
      CREATE INDEX IF NOT EXISTS "cards_set_idx" ON "cards" ("set");
      CREATE INDEX IF NOT EXISTS "cards_status_idx" ON "cards" ("status");
      CREATE INDEX IF NOT EXISTS "cards_deleted_at_idx" ON "cards" ("deleted_at");
      CREATE INDEX IF NOT EXISTS "sealed_name_idx" ON "sealed_products" ("name");
      CREATE INDEX IF NOT EXISTS "sealed_set_idx" ON "sealed_products" ("set");
      CREATE INDEX IF NOT EXISTS "sealed_status_idx" ON "sealed_products" ("status");
      CREATE INDEX IF NOT EXISTS "sealed_deleted_at_idx" ON "sealed_products" ("deleted_at");
      CREATE UNIQUE INDEX IF NOT EXISTS "card_set_totals_set_name_unique" ON "card_set_totals" ("set_name");
      CREATE INDEX IF NOT EXISTS "ps_card_id_idx" ON "price_snapshots" ("card_id");
      CREATE INDEX IF NOT EXISTS "ps_sealed_id_idx" ON "price_snapshots" ("sealed_product_id");
      CREATE INDEX IF NOT EXISTS "ps_snapshot_date_idx" ON "price_snapshots" ("snapshot_date");
      CREATE UNIQUE INDEX IF NOT EXISTS "cvh_date_unique" ON "collection_value_history" ("snapshot_date");
    `);
  })().catch((error) => {
    databaseSchemaReady = null;
    throw error;
  });

  return databaseSchemaReady;
}
