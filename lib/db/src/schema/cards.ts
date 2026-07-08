import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  pgEnum,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardStatusEnum = pgEnum("card_status", [
  "collection",
  "for_sale",
  "sold",
  "wishlist",
  "trade_binder",
  "grading_pile",
]);

export const sealedProductTypeEnum = pgEnum("sealed_product_type", [
  "ETB",
  "booster_box",
  "booster_pack",
  "tin",
  "binder",
  "case",
  "other",
]);

export const imageLabelEnum = pgEnum("image_label", [
  "front",
  "back",
  "damage",
  "receipt",
  "sealed",
  "other",
]);

export const cardsTable = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    set: text("set").notNull(),
    cardNumber: text("card_number"),
    rarity: text("rarity"),
    condition: text("condition"),
    grade: text("grade"),
    grader: text("grader"),
    quantity: integer("quantity").notNull().default(1),
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
    marketValue: numeric("market_value", { precision: 10, scale: 2 }),
    askingPrice: numeric("asking_price", { precision: 10, scale: 2 }),
    soldPrice: numeric("sold_price", { precision: 10, scale: 2 }),
    soldDate: date("sold_date"),
    purchaseDate: date("purchase_date"),
    purchaseSource: text("purchase_source"),
    tradeNotes: text("trade_notes"),
    status: cardStatusEnum("status").notNull().default("collection"),
    location: text("location"),
    notes: text("notes"),
    coverImagePath: text("cover_image_path"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("cards_name_idx").on(table.name),
    index("cards_set_idx").on(table.set),
    index("cards_status_idx").on(table.status),
    index("cards_deleted_at_idx").on(table.deletedAt),
  ],
);

export const sealedProductsTable = pgTable(
  "sealed_products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    productType: sealedProductTypeEnum("product_type").notNull().default("other"),
    set: text("set"),
    quantity: integer("quantity").notNull().default(1),
    condition: text("condition"),
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
    marketValue: numeric("market_value", { precision: 10, scale: 2 }),
    askingPrice: numeric("asking_price", { precision: 10, scale: 2 }),
    soldPrice: numeric("sold_price", { precision: 10, scale: 2 }),
    soldDate: date("sold_date"),
    purchaseDate: date("purchase_date"),
    purchaseSource: text("purchase_source"),
    tradeNotes: text("trade_notes"),
    status: cardStatusEnum("status").notNull().default("collection"),
    location: text("location"),
    notes: text("notes"),
    coverImagePath: text("cover_image_path"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("sealed_name_idx").on(table.name),
    index("sealed_set_idx").on(table.set),
    index("sealed_status_idx").on(table.status),
    index("sealed_deleted_at_idx").on(table.deletedAt),
  ],
);

export const itemImagesTable = pgTable("item_images", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id"),
  sealedProductId: integer("sealed_product_id"),
  objectPath: text("object_path").notNull(),
  label: imageLabelEnum("label").notNull().default("other"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cardSetTotalsTable = pgTable(
  "card_set_totals",
  {
    id: serial("id").primaryKey(),
    setName: text("set_name").notNull(),
    totalCards: integer("total_cards").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("card_set_totals_set_name_unique").on(table.setName)],
);

export const insertCardSchema = createInsertSchema(cardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;

export const insertSealedProductSchema = createInsertSchema(
  sealedProductsTable,
).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertSealedProduct = z.infer<typeof insertSealedProductSchema>;
export type SealedProduct = typeof sealedProductsTable.$inferSelect;

export const insertItemImageSchema = createInsertSchema(itemImagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertItemImage = z.infer<typeof insertItemImageSchema>;
export type ItemImage = typeof itemImagesTable.$inferSelect;

export const insertCardSetTotalSchema = createInsertSchema(cardSetTotalsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertCardSetTotal = z.infer<typeof insertCardSetTotalSchema>;
export type CardSetTotal = typeof cardSetTotalsTable.$inferSelect;
