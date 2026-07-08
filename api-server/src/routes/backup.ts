import { Router, type IRouter } from "express";
import { db, pool, cardsTable, sealedProductsTable, itemImagesTable, priceSnapshotsTable, collectionValueHistoryTable } from "@workspace/db";
import { sql, isNull } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

const SNAPSHOT_VERSION = "3";

router.get("/backup/snapshot", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const cards = await db.select().from(cardsTable).orderBy(cardsTable.id);
  const sealed = await db.select().from(sealedProductsTable).orderBy(sealedProductsTable.id);
  const allImages = await db.select().from(itemImagesTable).orderBy(itemImagesTable.id);
  const priceSnapshots = await db.select().from(priceSnapshotsTable).orderBy(priceSnapshotsTable.id);
  const valueHistory = await db.select().from(collectionValueHistoryTable).orderBy(collectionValueHistoryTable.snapshotDate);

  const imagesByCard = new Map<number, typeof allImages>();
  const imagesBySealed = new Map<number, typeof allImages>();

  for (const img of allImages) {
    if (img.cardId != null) {
      if (!imagesByCard.has(img.cardId)) imagesByCard.set(img.cardId, []);
      imagesByCard.get(img.cardId)!.push(img);
    }
    if (img.sealedProductId != null) {
      if (!imagesBySealed.has(img.sealedProductId)) imagesBySealed.set(img.sealedProductId, []);
      imagesBySealed.get(img.sealedProductId)!.push(img);
    }
  }

  const ownerId = req.user?.id ?? null;

  const snapshot = {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    ownerId,
    storageNote:
      "Images are stored in Replit Object Storage (GCS). The objectPath in each image record is the path in the bucket. " +
      "After restoring this backup, images are served at /api/storage/objects/{objectPath} and remain accessible " +
      "as long as the bucket exists. Images persist across deployments and server restarts.",
    cards: cards.map((c) => ({
      ...c,
      purchasePrice: c.purchasePrice != null ? Number(c.purchasePrice) : null,
      marketValue: c.marketValue != null ? Number(c.marketValue) : null,
      askingPrice: c.askingPrice != null ? Number(c.askingPrice) : null,
      soldPrice: c.soldPrice != null ? Number(c.soldPrice) : null,
      images: imagesByCard.get(c.id) ?? [],
    })),
    sealedProducts: sealed.map((p) => ({
      ...p,
      purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
      marketValue: p.marketValue != null ? Number(p.marketValue) : null,
      askingPrice: p.askingPrice != null ? Number(p.askingPrice) : null,
      soldPrice: p.soldPrice != null ? Number(p.soldPrice) : null,
      images: imagesBySealed.get(p.id) ?? [],
    })),
    priceSnapshots: priceSnapshots.map((ps) => ({
      ...ps,
      marketValue: Number(ps.marketValue),
    })),
    collectionValueHistory: valueHistory.map((h) => ({
      ...h,
      totalValue: Number(h.totalValue),
      cardsValue: Number(h.cardsValue),
      sealedValue: Number(h.sealedValue),
    })),
  };

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="pokevault-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  res.json(snapshot);
});

const BackupImageSchema = z.object({
  id: z.number().int(),
  cardId: z.number().int().nullable().optional(),
  sealedProductId: z.number().int().nullable().optional(),
  objectPath: z.string(),
  label: z.enum(["front", "back", "damage", "receipt", "sealed", "other"]),
  caption: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
});

const BackupCardSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  set: z.string(),
  cardNumber: z.string().nullable().optional(),
  rarity: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  grader: z.string().nullable().optional(),
  quantity: z.number().int().optional(),
  purchasePrice: z.number().nullable().optional(),
  marketValue: z.number().nullable().optional(),
  askingPrice: z.number().nullable().optional(),
  soldPrice: z.number().nullable().optional(),
  soldDate: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseSource: z.string().nullable().optional(),
  tradeNotes: z.string().nullable().optional(),
  status: z.enum(["collection", "for_sale", "sold", "wishlist", "trade_binder", "grading_pile"]).optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  coverImagePath: z.string().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  images: z.array(BackupImageSchema).optional(),
});

const BackupSealedSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productType: z.enum(["ETB", "booster_box", "booster_pack", "tin", "binder", "case", "other"]),
  set: z.string().nullable().optional(),
  quantity: z.number().int().optional(),
  condition: z.string().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  marketValue: z.number().nullable().optional(),
  askingPrice: z.number().nullable().optional(),
  soldPrice: z.number().nullable().optional(),
  soldDate: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseSource: z.string().nullable().optional(),
  tradeNotes: z.string().nullable().optional(),
  status: z.enum(["collection", "for_sale", "sold", "wishlist", "trade_binder", "grading_pile"]).optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  coverImagePath: z.string().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  images: z.array(BackupImageSchema).optional(),
});

const BackupPriceSnapshotSchema = z.object({
  id: z.number().int(),
  cardId: z.number().int().nullable().optional(),
  sealedProductId: z.number().int().nullable().optional(),
  marketValue: z.number(),
  source: z.string().optional(),
  snapshotDate: z.string(),
  createdAt: z.coerce.date().optional(),
});

const BackupCollectionValueHistorySchema = z.object({
  id: z.number().int(),
  snapshotDate: z.string(),
  totalValue: z.number(),
  cardsValue: z.number(),
  sealedValue: z.number(),
  itemCount: z.number().int(),
  cardCount: z.number().int(),
  sealedCount: z.number().int(),
  createdAt: z.coerce.date().optional(),
});

const BackupSnapshotSchema = z.object({
  version: z.string(),
  cards: z.array(BackupCardSchema),
  sealedProducts: z.array(BackupSealedSchema),
  priceSnapshots: z.array(BackupPriceSnapshotSchema).optional(),
  collectionValueHistory: z.array(BackupCollectionValueHistorySchema).optional(),
});

router.post("/backup/restore", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = BackupSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid backup format: " + parsed.error.message });
    return;
  }

  const { cards, sealedProducts, priceSnapshots = [], collectionValueHistory = [] } = parsed.data;
  let cardCount = 0;
  let sealedCount = 0;
  let imageCount = 0;
  let priceSnapshotCount = 0;
  let historyCount = 0;

  await db.transaction(async (tx) => {
    for (const c of cards) {
      const row = {
        id: c.id,
        name: c.name,
        set: c.set,
        cardNumber: c.cardNumber ?? null,
        rarity: c.rarity ?? null,
        condition: c.condition ?? null,
        grade: c.grade ?? null,
        grader: c.grader ?? null,
        quantity: c.quantity ?? 1,
        purchasePrice: c.purchasePrice != null ? String(c.purchasePrice) : null,
        marketValue: c.marketValue != null ? String(c.marketValue) : null,
        askingPrice: c.askingPrice != null ? String(c.askingPrice) : null,
        soldPrice: c.soldPrice != null ? String(c.soldPrice) : null,
        soldDate: c.soldDate ?? null,
        purchaseDate: c.purchaseDate ?? null,
        purchaseSource: c.purchaseSource ?? null,
        tradeNotes: c.tradeNotes ?? null,
        status: c.status ?? ("collection" as const),
        location: c.location ?? null,
        notes: c.notes ?? null,
        coverImagePath: c.coverImagePath ?? null,
        deletedAt: c.deletedAt ?? null,
        createdAt: c.createdAt ?? new Date(),
        updatedAt: c.updatedAt ?? new Date(),
      };
      await tx.insert(cardsTable).values(row).onConflictDoUpdate({
        target: cardsTable.id,
        set: {
          name: row.name, set: row.set, cardNumber: row.cardNumber, rarity: row.rarity,
          condition: row.condition, grade: row.grade, grader: row.grader, quantity: row.quantity,
          purchasePrice: row.purchasePrice, marketValue: row.marketValue, askingPrice: row.askingPrice,
          soldPrice: row.soldPrice, soldDate: row.soldDate, purchaseDate: row.purchaseDate,
          purchaseSource: row.purchaseSource, tradeNotes: row.tradeNotes, status: row.status,
          location: row.location, notes: row.notes, coverImagePath: row.coverImagePath,
          deletedAt: row.deletedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
        },
      });
      cardCount++;

      for (const img of c.images ?? []) {
        await tx.insert(itemImagesTable).values({
          id: img.id, cardId: c.id, sealedProductId: null,
          objectPath: img.objectPath, label: img.label,
          caption: img.caption ?? null, sortOrder: img.sortOrder ?? 0,
          createdAt: img.createdAt ?? new Date(),
        }).onConflictDoUpdate({
          target: itemImagesTable.id,
          set: { cardId: c.id, objectPath: img.objectPath, label: img.label, caption: img.caption ?? null, sortOrder: img.sortOrder ?? 0 },
        });
        imageCount++;
      }
    }

    for (const p of sealedProducts) {
      const row = {
        id: p.id, name: p.name, productType: p.productType, set: p.set ?? null, quantity: p.quantity ?? 1,
        condition: p.condition ?? null, purchasePrice: p.purchasePrice != null ? String(p.purchasePrice) : null,
        marketValue: p.marketValue != null ? String(p.marketValue) : null,
        askingPrice: p.askingPrice != null ? String(p.askingPrice) : null,
        soldPrice: p.soldPrice != null ? String(p.soldPrice) : null,
        soldDate: p.soldDate ?? null, purchaseDate: p.purchaseDate ?? null,
        purchaseSource: p.purchaseSource ?? null, tradeNotes: p.tradeNotes ?? null,
        status: p.status ?? ("collection" as const), location: p.location ?? null,
        notes: p.notes ?? null, coverImagePath: p.coverImagePath ?? null,
        deletedAt: p.deletedAt ?? null, createdAt: p.createdAt ?? new Date(), updatedAt: p.updatedAt ?? new Date(),
      };
      await tx.insert(sealedProductsTable).values(row).onConflictDoUpdate({
        target: sealedProductsTable.id,
        set: {
          name: row.name, productType: row.productType, set: row.set, quantity: row.quantity,
          condition: row.condition, purchasePrice: row.purchasePrice, marketValue: row.marketValue,
          askingPrice: row.askingPrice, soldPrice: row.soldPrice, soldDate: row.soldDate,
          purchaseDate: row.purchaseDate, purchaseSource: row.purchaseSource, tradeNotes: row.tradeNotes,
          status: row.status, location: row.location, notes: row.notes, coverImagePath: row.coverImagePath,
          deletedAt: row.deletedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
        },
      });
      sealedCount++;

      for (const img of p.images ?? []) {
        await tx.insert(itemImagesTable).values({
          id: img.id, cardId: null, sealedProductId: p.id,
          objectPath: img.objectPath, label: img.label,
          caption: img.caption ?? null, sortOrder: img.sortOrder ?? 0,
          createdAt: img.createdAt ?? new Date(),
        }).onConflictDoUpdate({
          target: itemImagesTable.id,
          set: { sealedProductId: p.id, objectPath: img.objectPath, label: img.label, caption: img.caption ?? null, sortOrder: img.sortOrder ?? 0 },
        });
        imageCount++;
      }
    }

    for (const ps of priceSnapshots) {
      await tx.insert(priceSnapshotsTable).values({
        id: ps.id,
        cardId: ps.cardId ?? null,
        sealedProductId: ps.sealedProductId ?? null,
        marketValue: String(ps.marketValue),
        source: ps.source ?? "manual",
        snapshotDate: ps.snapshotDate,
        createdAt: ps.createdAt ?? new Date(),
      }).onConflictDoNothing();
      priceSnapshotCount++;
    }

    for (const h of collectionValueHistory) {
      await tx.insert(collectionValueHistoryTable).values({
        id: h.id,
        snapshotDate: h.snapshotDate,
        totalValue: String(h.totalValue),
        cardsValue: String(h.cardsValue),
        sealedValue: String(h.sealedValue),
        itemCount: h.itemCount,
        cardCount: h.cardCount,
        sealedCount: h.sealedCount,
        createdAt: h.createdAt ?? new Date(),
      }).onConflictDoNothing();
      historyCount++;
    }
  });

  await pool.query("SELECT setval('cards_id_seq', COALESCE((SELECT MAX(id) FROM cards), 0))");
  await pool.query("SELECT setval('sealed_products_id_seq', COALESCE((SELECT MAX(id) FROM sealed_products), 0))");
  await pool.query("SELECT setval('item_images_id_seq', COALESCE((SELECT MAX(id) FROM item_images), 0))");
  if (priceSnapshotCount > 0) {
    await pool.query("SELECT setval('price_snapshots_id_seq', COALESCE((SELECT MAX(id) FROM price_snapshots), 0))");
  }
  if (historyCount > 0) {
    await pool.query("SELECT setval('collection_value_history_id_seq', COALESCE((SELECT MAX(id) FROM collection_value_history), 0))");
  }

  res.json({
    cards: cardCount, sealedProducts: sealedCount, images: imageCount,
    priceSnapshots: priceSnapshotCount, collectionValueHistory: historyCount,
    sequencesReset: true,
  });
});

export default router;
