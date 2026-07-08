import { Router, type IRouter } from "express";
import { sql, isNull, and } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /analytics/sets-performance ────────────────────────────────────────

router.get("/analytics/sets-performance", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [cardsBySet, sealedBySet] = await Promise.all([
    db.select({
      set: cardsTable.set,
      cardCount: sql<number>`count(*)::int`,
      totalQuantity: sql<number>`coalesce(sum(quantity), 0)::int`,
      totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
      totalMarketValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status not in ('sold','wishlist')`))
      .groupBy(cardsTable.set)
      .orderBy(sql`sum(coalesce(market_value,purchase_price)::numeric * quantity) desc nulls last`),

    db.select({
      set: sealedProductsTable.set,
      sealedCount: sql<number>`count(*)::int`,
      sealedQuantity: sql<number>`coalesce(sum(quantity), 0)::int`,
      sealedCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
      sealedMarketValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(sealedProductsTable)
      .where(and(isNull(sealedProductsTable.deletedAt), sql`status not in ('sold','wishlist')`))
      .groupBy(sealedProductsTable.set),
  ]);

  // Merge by set name
  const sealedMap = new Map(sealedBySet.map((s) => [s.set ?? "__unsealed__", s]));
  const setMap = new Map<string, {
    set: string; cardCount: number; sealedCount: number; totalQuantity: number;
    totalCost: number; totalMarketValue: number; totalGain: number; gainPct: number | null;
  }>();

  for (const c of cardsBySet) {
    const sealed = sealedMap.get(c.set);
    const totalCost = Number(c.totalCost) + (sealed ? Number(sealed.sealedCost) : 0);
    const totalMarketValue = Number(c.totalMarketValue) + (sealed ? Number(sealed.sealedMarketValue) : 0);
    const totalGain = totalMarketValue - totalCost;
    const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : null;
    setMap.set(c.set, {
      set: c.set,
      cardCount: Number(c.cardCount),
      sealedCount: sealed ? Number(sealed.sealedCount) : 0,
      totalQuantity: Number(c.totalQuantity) + (sealed ? Number(sealed.sealedQuantity) : 0),
      totalCost,
      totalMarketValue,
      totalGain,
      gainPct,
    });
  }

  // Include sealed-only sets
  for (const s of sealedBySet) {
    const key = s.set ?? "__unsealed__";
    if (!setMap.has(key)) {
      const totalCost = Number(s.sealedCost);
      const totalMarketValue = Number(s.sealedMarketValue);
      const totalGain = totalMarketValue - totalCost;
      setMap.set(key, {
        set: s.set ?? "(no set)",
        cardCount: 0,
        sealedCount: Number(s.sealedCount),
        totalQuantity: Number(s.sealedQuantity),
        totalCost,
        totalMarketValue,
        totalGain,
        gainPct: totalCost > 0 ? (totalGain / totalCost) * 100 : null,
      });
    }
  }

  const result = [...setMap.values()].sort((a, b) => b.totalMarketValue - a.totalMarketValue);
  res.json(result);
});

// ─── GET /analytics/acquisitions ────────────────────────────────────────────

router.get("/analytics/acquisitions", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [cardRows, sealedRows] = await Promise.all([
    db.select({
      year: sql<number>`extract(year from coalesce(purchase_date::date, created_at::date))::int`,
      month: sql<number>`extract(month from coalesce(purchase_date::date, created_at::date))::int`,
      cardCount: sql<number>`count(*)::int`,
      totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
      totalMarketValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status != 'wishlist'`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`1, 2`),

    db.select({
      year: sql<number>`extract(year from coalesce(purchase_date::date, created_at::date))::int`,
      month: sql<number>`extract(month from coalesce(purchase_date::date, created_at::date))::int`,
      sealedCount: sql<number>`count(*)::int`,
      totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
      totalMarketValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(sealedProductsTable)
      .where(and(isNull(sealedProductsTable.deletedAt), sql`status != 'wishlist'`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`1, 2`),
  ]);

  // Merge by year+month
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthMap = new Map<string, {
    year: number; month: number; label: string;
    cardCount: number; sealedCount: number; totalCost: number; totalMarketValue: number;
  }>();

  for (const c of cardRows) {
    const key = `${c.year}-${String(c.month).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { year: Number(c.year), month: Number(c.month), label: `${MONTH_NAMES[Number(c.month) - 1]} ${c.year}`, cardCount: 0, sealedCount: 0, totalCost: 0, totalMarketValue: 0 });
    }
    const m = monthMap.get(key)!;
    m.cardCount += Number(c.cardCount);
    m.totalCost += Number(c.totalCost);
    m.totalMarketValue += Number(c.totalMarketValue);
  }

  for (const s of sealedRows) {
    const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { year: Number(s.year), month: Number(s.month), label: `${MONTH_NAMES[Number(s.month) - 1]} ${s.year}`, cardCount: 0, sealedCount: 0, totalCost: 0, totalMarketValue: 0 });
    }
    const m = monthMap.get(key)!;
    m.sealedCount += Number(s.sealedCount);
    m.totalCost += Number(s.totalCost);
    m.totalMarketValue += Number(s.totalMarketValue);
  }

  const result = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24)
    .map(([, v]) => v);

  res.json(result);
});

// ─── GET /analytics/sold-performance ────────────────────────────────────────

router.get("/analytics/sold-performance", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [cardSoldRows, sealedSoldRows, topCardSellers, topSealedSellers] = await Promise.all([
    db.select({
      year: sql<number>`extract(year from sold_date::date)::int`,
      month: sql<number>`extract(month from sold_date::date)::int`,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(sold_price::numeric * quantity), 0)`,
      cost: sql<number>`coalesce(sum(coalesce(purchase_price,0)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status = 'sold' and sold_date is not null`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`1, 2`),

    db.select({
      year: sql<number>`extract(year from sold_date::date)::int`,
      month: sql<number>`extract(month from sold_date::date)::int`,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(sold_price::numeric * quantity), 0)`,
      cost: sql<number>`coalesce(sum(coalesce(purchase_price,0)::numeric * quantity), 0)`,
    }).from(sealedProductsTable)
      .where(and(isNull(sealedProductsTable.deletedAt), sql`status = 'sold' and sold_date is not null`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`1, 2`),

    db.select({
      id: cardsTable.id,
      name: cardsTable.name,
      set: cardsTable.set,
      soldPrice: cardsTable.soldPrice,
      purchasePrice: cardsTable.purchasePrice,
      soldDate: cardsTable.soldDate,
      quantity: cardsTable.quantity,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status = 'sold' and sold_price is not null and purchase_price is not null`))
      .orderBy(sql`(sold_price::numeric - coalesce(purchase_price,0)::numeric) * quantity desc`)
      .limit(20),

    db.select({
      id: sealedProductsTable.id,
      name: sealedProductsTable.name,
      set: sealedProductsTable.set,
      soldPrice: sealedProductsTable.soldPrice,
      purchasePrice: sealedProductsTable.purchasePrice,
      soldDate: sealedProductsTable.soldDate,
      quantity: sealedProductsTable.quantity,
    }).from(sealedProductsTable)
      .where(and(isNull(sealedProductsTable.deletedAt), sql`status = 'sold' and sold_price is not null and purchase_price is not null`))
      .orderBy(sql`(sold_price::numeric - coalesce(purchase_price,0)::numeric) * quantity desc`)
      .limit(10),
  ]);

  // Merge by month
  const monthMap = new Map<string, { year: number; month: number; label: string; count: number; revenue: number; cost: number; profit: number }>();
  for (const r of [...cardSoldRows, ...sealedSoldRows]) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { year: Number(r.year), month: Number(r.month), label: `${MONTH_NAMES[Number(r.month) - 1]} ${r.year}`, count: 0, revenue: 0, cost: 0, profit: 0 });
    }
    const m = monthMap.get(key)!;
    m.count += Number(r.count);
    m.revenue += Number(r.revenue);
    m.cost += Number(r.cost);
    m.profit = m.revenue - m.cost;
  }

  const byMonth = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  const topSellers = [
    ...topCardSellers.map((c) => {
      const sp = Number(c.soldPrice); const pp = Number(c.purchasePrice); const q = c.quantity ?? 1;
      const profit = (sp - pp) * q;
      const profitPct = pp > 0 ? ((sp - pp) / pp) * 100 : 0;
      return { id: c.id, itemType: "card" as const, name: c.name, set: c.set ?? null, soldPrice: sp * q, purchasePrice: pp * q, profit, profitPct, soldDate: c.soldDate ?? null };
    }),
    ...topSealedSellers.map((p) => {
      const sp = Number(p.soldPrice); const pp = Number(p.purchasePrice); const q = p.quantity ?? 1;
      const profit = (sp - pp) * q;
      const profitPct = pp > 0 ? ((sp - pp) / pp) * 100 : 0;
      return { id: p.id, itemType: "sealed_product" as const, name: p.name, set: p.set ?? null, soldPrice: sp * q, purchasePrice: pp * q, profit, profitPct, soldDate: p.soldDate ?? null };
    }),
  ].sort((a, b) => b.profit - a.profit).slice(0, 20);

  const totalRevenue = topSellers.reduce((s, t) => s + t.soldPrice, 0);
  const totalCost = topSellers.reduce((s, t) => s + t.purchasePrice, 0);
  const totalProfit = totalRevenue - totalCost;
  const [cardSoldCount, sealedSoldCount] = await Promise.all([
    db.select({ cnt: sql<number>`count(*)::int` }).from(cardsTable).where(and(isNull(cardsTable.deletedAt), sql`status = 'sold'`)),
    db.select({ cnt: sql<number>`count(*)::int` }).from(sealedProductsTable).where(and(isNull(sealedProductsTable.deletedAt), sql`status = 'sold'`)),
  ]);
  const totalSold = (cardSoldCount[0]?.cnt ?? 0) + (sealedSoldCount[0]?.cnt ?? 0);

  res.json({ byMonth, topSellers, totalRevenue, totalCost, totalProfit, totalSold });
});

// ─── GET /analytics/inventory-breakdown ─────────────────────────────────────

router.get("/analytics/inventory-breakdown", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [graded, raw, byGrade, tiers] = await Promise.all([
    db.select({
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`grade is not null and status not in ('sold','wishlist')`)),

    db.select({
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`grade is null and status not in ('sold','wishlist')`)),

    db.select({
      grade: cardsTable.grade,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`grade is not null and status not in ('sold','wishlist')`))
      .groupBy(cardsTable.grade)
      .orderBy(sql`count(*) desc`),

    db.select({
      tier: sql<string>`
        case
          when market_value is null or market_value::numeric = 0 then 'unknown'
          when market_value::numeric < 5 then 'under_5'
          when market_value::numeric < 25 then '5_25'
          when market_value::numeric < 100 then '25_100'
          else 'over_100'
        end`,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status not in ('sold','wishlist')`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const TIER_META: Record<string, string> = {
    unknown: "No value set",
    under_5: "Under $5",
    "5_25": "$5 – $25",
    "25_100": "$25 – $100",
    over_100: "Over $100",
  };
  const TIER_ORDER = ["unknown", "under_5", "5_25", "25_100", "over_100"];

  const byValueTier = TIER_ORDER.map((tier) => {
    const row = tiers.find((t) => t.tier === tier);
    return { tier, label: TIER_META[tier] ?? tier, count: row ? Number(row.count) : 0, totalValue: row ? Number(row.totalValue) : 0 };
  });

  res.json({
    graded: { count: Number(graded[0]?.count ?? 0), totalValue: Number(graded[0]?.totalValue ?? 0) },
    raw: { count: Number(raw[0]?.count ?? 0), totalValue: Number(raw[0]?.totalValue ?? 0) },
    byValueTier,
    byGrade: byGrade.map((g) => ({ grade: g.grade ?? "?", count: Number(g.count), totalValue: Number(g.totalValue) })),
  });
});

// ─── GET /analytics/wishlist ─────────────────────────────────────────────────

router.get("/analytics/wishlist", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [wishlistCards, wishlistSealed] = await Promise.all([
    db.select({
      id: cardsTable.id,
      name: cardsTable.name,
      set: cardsTable.set,
      purchasePrice: cardsTable.purchasePrice,
      notes: cardsTable.notes,
    }).from(cardsTable)
      .where(and(isNull(cardsTable.deletedAt), sql`status = 'wishlist'`))
      .orderBy(sql`purchase_price::numeric desc nulls last`),

    db.select({
      id: sealedProductsTable.id,
      name: sealedProductsTable.name,
      set: sealedProductsTable.set,
      purchasePrice: sealedProductsTable.purchasePrice,
      notes: sealedProductsTable.notes,
    }).from(sealedProductsTable)
      .where(and(isNull(sealedProductsTable.deletedAt), sql`status = 'wishlist'`))
      .orderBy(sql`purchase_price::numeric desc nulls last`),
  ]);

  const items = [
    ...wishlistCards.map((c) => ({ id: c.id, itemType: "card" as const, name: c.name, set: c.set ?? null, purchasePrice: c.purchasePrice ? Number(c.purchasePrice) : null, notes: c.notes ?? null })),
    ...wishlistSealed.map((p) => ({ id: p.id, itemType: "sealed_product" as const, name: p.name, set: p.set ?? null, purchasePrice: p.purchasePrice ? Number(p.purchasePrice) : null, notes: p.notes ?? null })),
  ].sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0));

  const estimatedCost = items.reduce((s, i) => s + (i.purchasePrice ?? 0), 0);

  res.json({
    cardCount: wishlistCards.length,
    sealedCount: wishlistSealed.length,
    totalItems: items.length,
    estimatedCost,
    items,
  });
});

export default router;
