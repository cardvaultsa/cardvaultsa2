import { Router, type IRouter } from "express";
import { sql, isNull, eq } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable, cardSetTotalsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/cards/duplicates", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const duplicates = await db
    .select({
      name: cardsTable.name,
      set: cardsTable.set,
      rowCount: sql<number>`count(*)::int`,
      totalQuantity: sql<number>`sum(quantity)::int`,
      ids: sql<number[]>`array_agg(id order by id)`,
      statuses: sql<string[]>`array_agg(status order by id)`,
    })
    .from(cardsTable)
    .where(isNull(cardsTable.deletedAt))
    .groupBy(cardsTable.name, cardsTable.set)
    .having(sql`count(*) > 1`)
    .orderBy(sql`count(*) desc, name asc`);

  res.json(duplicates);
});

router.get("/collection/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [cardsByStatus, sealedByStatus, cardsBySet, cardsByRarity, cardsByCondition,
    sealedByProductType, sealedByCondition, setTotals] = await Promise.all([
    db.select({
      status: cardsTable.status,
      count: sql<number>`count(*)::int`,
    }).from(cardsTable).where(isNull(cardsTable.deletedAt))
      .groupBy(cardsTable.status).orderBy(sql`count(*) desc`),

    db.select({
      status: sealedProductsTable.status,
      count: sql<number>`count(*)::int`,
    }).from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt))
      .groupBy(sealedProductsTable.status).orderBy(sql`count(*) desc`),

    db.select({
      set: cardsTable.set,
      cardRows: sql<number>`count(*)::int`,
      totalOwned: sql<number>`sum(quantity)::int`,
      uniqueCardNumbers: sql<number>`count(distinct card_number) filter (where card_number is not null)::int`,
    }).from(cardsTable).where(isNull(cardsTable.deletedAt))
      .groupBy(cardsTable.set).orderBy(sql`count(*) desc`),

    db.select({
      rarity: cardsTable.rarity,
      count: sql<number>`count(*)::int`,
    }).from(cardsTable)
      .where(sql`${isNull(cardsTable.deletedAt)} and rarity is not null`)
      .groupBy(cardsTable.rarity).orderBy(sql`count(*) desc`),

    db.select({
      condition: cardsTable.condition,
      count: sql<number>`count(*)::int`,
    }).from(cardsTable)
      .where(sql`${isNull(cardsTable.deletedAt)} and condition is not null`)
      .groupBy(cardsTable.condition).orderBy(sql`count(*) desc`),

    db.select({
      productType: sealedProductsTable.productType,
      count: sql<number>`count(*)::int`,
    }).from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt))
      .groupBy(sealedProductsTable.productType).orderBy(sql`count(*) desc`),

    db.select({
      condition: sealedProductsTable.condition,
      count: sql<number>`count(*)::int`,
    }).from(sealedProductsTable)
      .where(sql`${isNull(sealedProductsTable.deletedAt)} and condition is not null`)
      .groupBy(sealedProductsTable.condition).orderBy(sql`count(*) desc`),

    db.select().from(cardSetTotalsTable),
  ]);

  const setTotalsMap = new Map(setTotals.map((t) => [t.setName, t.totalCards]));

  const cardsBySetWithCompletion = cardsBySet.map((row) => {
    const total = setTotalsMap.get(row.set) ?? null;
    const completion =
      total != null && total > 0 && row.uniqueCardNumbers > 0
        ? Math.round((row.uniqueCardNumbers / total) * 1000) / 10
        : null;
    return { ...row, setTotal: total, completion };
  });

  const totalCards = cardsByStatus.reduce((s, r) => s + r.count, 0);
  const totalSealed = sealedByStatus.reduce((s, r) => s + r.count, 0);
  const wishlistCards = cardsByStatus.find((r) => r.status === "wishlist")?.count ?? 0;
  const wishlistSealed = sealedByStatus.find((r) => r.status === "wishlist")?.count ?? 0;

  res.json({
    cards: {
      total: totalCards,
      wishlist: wishlistCards,
      byStatus: cardsByStatus,
      bySet: cardsBySetWithCompletion,
      byRarity: cardsByRarity,
      byCondition: cardsByCondition,
    },
    sealed: {
      total: totalSealed,
      wishlist: wishlistSealed,
      byStatus: sealedByStatus,
      byProductType: sealedByProductType,
      byCondition: sealedByCondition,
    },
  });
});

router.get("/collection/set-totals", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select().from(cardSetTotalsTable).orderBy(cardSetTotalsTable.setName);
  res.json(rows);
});

const SetTotalBody = z.object({
  totalCards: z.number().int().min(0),
});

router.put("/collection/set-totals/:setName", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { setName } = req.params;
  const parsed = SetTotalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(cardSetTotalsTable)
    .values({ setName, totalCards: parsed.data.totalCards, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cardSetTotalsTable.setName,
      set: { totalCards: parsed.data.totalCards, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

export default router;
