import { Router, type IRouter } from "express";
import { sql, isNull } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable, expensesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [cardStats] = await db.select({
    totalCards: sql<number>`count(*)::int`,
    totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
    totalMarketValue: sql<number>`coalesce(sum(market_value::numeric * quantity), 0)`,
    soldCount: sql<number>`count(*) filter (where status = 'sold')::int`,
    soldRevenue: sql<number>`coalesce(sum(case when status = 'sold' then sold_price::numeric * quantity else 0 end), 0)`,
    soldCost: sql<number>`coalesce(sum(case when status = 'sold' then purchase_price::numeric * quantity else 0 end), 0)`,
    forSaleCount: sql<number>`count(*) filter (where status = 'for_sale')::int`,
    collectionCount: sql<number>`count(*) filter (where status = 'collection')::int`,
    tradeBinderCount: sql<number>`count(*) filter (where status = 'trade_binder')::int`,
    gradingPileCount: sql<number>`count(*) filter (where status = 'grading_pile')::int`,
    wishlistCount: sql<number>`count(*) filter (where status = 'wishlist')::int`,
    collectionValue: sql<number>`coalesce(sum(case when status = 'collection' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    forSaleValue: sql<number>`coalesce(sum(case when status = 'for_sale' then coalesce(asking_price::numeric,0) * quantity else 0 end), 0)`,
    tradeBinderValue: sql<number>`coalesce(sum(case when status = 'trade_binder' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    gradingPileValue: sql<number>`coalesce(sum(case when status = 'grading_pile' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    wishlistValue: sql<number>`coalesce(sum(case when status = 'wishlist' then coalesce(purchase_price::numeric,0) * quantity else 0 end), 0)`,
  }).from(cardsTable).where(isNull(cardsTable.deletedAt));

  const [sealedStats] = await db.select({
    totalSealedProducts: sql<number>`count(*)::int`,
    sealedCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
    sealedMarketValue: sql<number>`coalesce(sum(market_value::numeric * quantity), 0)`,
    sealedSoldCount: sql<number>`count(*) filter (where status = 'sold')::int`,
    sealedSoldRevenue: sql<number>`coalesce(sum(case when status = 'sold' then sold_price::numeric * quantity else 0 end), 0)`,
    sealedSoldCost: sql<number>`coalesce(sum(case when status = 'sold' then purchase_price::numeric * quantity else 0 end), 0)`,
    sealedForSaleCount: sql<number>`count(*) filter (where status = 'for_sale')::int`,
    sealedCollectionCount: sql<number>`count(*) filter (where status = 'collection')::int`,
    sealedTradeBinderCount: sql<number>`count(*) filter (where status = 'trade_binder')::int`,
    sealedGradingPileCount: sql<number>`count(*) filter (where status = 'grading_pile')::int`,
    sealedWishlistCount: sql<number>`count(*) filter (where status = 'wishlist')::int`,
    sealedCollectionValue: sql<number>`coalesce(sum(case when status = 'collection' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    sealedForSaleValue: sql<number>`coalesce(sum(case when status = 'for_sale' then coalesce(asking_price::numeric,0) * quantity else 0 end), 0)`,
    sealedTradeBinderValue: sql<number>`coalesce(sum(case when status = 'trade_binder' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    sealedGradingPileValue: sql<number>`coalesce(sum(case when status = 'grading_pile' then coalesce(market_value::numeric,0) * quantity else 0 end), 0)`,
    sealedWishlistValue: sql<number>`coalesce(sum(case when status = 'wishlist' then coalesce(purchase_price::numeric,0) * quantity else 0 end), 0)`,
  }).from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt));

  const [expenseStats] = await db.select({
    totalExpenses: sql<number>`coalesce(sum(amount::numeric), 0)`,
  }).from(expensesTable);

  const totalCost = Number(cardStats.totalCost) + Number(sealedStats.sealedCost);
  const totalMarketValue = Number(cardStats.totalMarketValue) + Number(sealedStats.sealedMarketValue);
  const soldRevenue = Number(cardStats.soldRevenue) + Number(sealedStats.sealedSoldRevenue);
  const soldCost = Number(cardStats.soldCost) + Number(sealedStats.sealedSoldCost);
  const totalExpenses = Number(expenseStats.totalExpenses);
  const unrealizedProfit = totalMarketValue - totalCost;
  const realizedProfit = soldRevenue - soldCost;
  const estimatedProfit = unrealizedProfit;
  const soldProfit = realizedProfit;
  const netProfit = soldProfit - totalExpenses;
  const cardCollectionValue = Number(cardStats.collectionValue);
  const sealedCollectionValue = Number(sealedStats.sealedCollectionValue);
  const collectionValue = cardCollectionValue + sealedCollectionValue;
  const forSaleValue = Number(cardStats.forSaleValue) + Number(sealedStats.sealedForSaleValue);
  const tradeBinderCount = Number(cardStats.tradeBinderCount) + Number(sealedStats.sealedTradeBinderCount);
  const gradingPileCount = Number(cardStats.gradingPileCount) + Number(sealedStats.sealedGradingPileCount);
  const wishlistCount = Number(cardStats.wishlistCount) + Number(sealedStats.sealedWishlistCount);
  const tradeBinderValue = Number(cardStats.tradeBinderValue) + Number(sealedStats.sealedTradeBinderValue);
  const gradingPileValue = Number(cardStats.gradingPileValue) + Number(sealedStats.sealedGradingPileValue);
  const wishlistValue = Number(cardStats.wishlistValue) + Number(sealedStats.sealedWishlistValue);

  res.json({
    totalCards: cardStats.totalCards,
    totalSealedProducts: sealedStats.totalSealedProducts,
    totalItems: cardStats.totalCards + sealedStats.totalSealedProducts,
    totalCost,
    totalMarketValue,
    estimatedProfit,
    soldCount: cardStats.soldCount + sealedStats.sealedSoldCount,
    soldRevenue,
    forSaleCount: cardStats.forSaleCount + sealedStats.sealedForSaleCount,
    collectionCount: cardStats.collectionCount + sealedStats.sealedCollectionCount,
    tradeBinderCount,
    gradingPileCount,
    wishlistCount,
    totalExpenses,
    netProfit,
    soldProfit,
    realizedProfit,
    unrealizedProfit,
    collectionValue,
    cardCollectionValue,
    sealedCollectionValue,
    forSaleValue,
    tradeBinderValue,
    gradingPileValue,
    wishlistValue,
  });
});

router.get("/dashboard/recent", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const recentCards = await db.select({
    id: cardsTable.id,
    name: cardsTable.name,
    status: cardsTable.status,
    coverImagePath: cardsTable.coverImagePath,
    createdAt: cardsTable.createdAt,
  }).from(cardsTable).where(isNull(cardsTable.deletedAt)).orderBy(sql`created_at desc`).limit(10);

  const recentSealed = await db.select({
    id: sealedProductsTable.id,
    name: sealedProductsTable.name,
    status: sealedProductsTable.status,
    coverImagePath: sealedProductsTable.coverImagePath,
    createdAt: sealedProductsTable.createdAt,
  }).from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt)).orderBy(sql`created_at desc`).limit(10);

  const allItems = [
    ...recentCards.map((c) => ({ ...c, type: "card" as const })),
    ...recentSealed.map((p) => ({ ...p, type: "sealed_product" as const })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  res.json({ items: allItems });
});

export default router;
