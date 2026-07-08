import { pgTable, serial, integer, numeric, date, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { cardsTable, sealedProductsTable } from "./cards";

export const priceSnapshotsTable = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id").references(() => cardsTable.id, { onDelete: "cascade" }),
    sealedProductId: integer("sealed_product_id").references(() => sealedProductsTable.id, { onDelete: "cascade" }),
    marketValue: numeric("market_value", { precision: 10, scale: 2 }).notNull(),
    source: text("source").notNull().default("manual"),
    snapshotDate: date("snapshot_date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ps_card_id_idx").on(t.cardId),
    index("ps_sealed_id_idx").on(t.sealedProductId),
    index("ps_snapshot_date_idx").on(t.snapshotDate),
  ],
);

export const collectionValueHistoryTable = pgTable(
  "collection_value_history",
  {
    id: serial("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
    cardsValue: numeric("cards_value", { precision: 12, scale: 2 }).notNull(),
    sealedValue: numeric("sealed_value", { precision: 12, scale: 2 }).notNull(),
    itemCount: integer("item_count").notNull(),
    cardCount: integer("card_count").notNull(),
    sealedCount: integer("sealed_count").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("cvh_date_unique").on(t.snapshotDate),
  ],
);
