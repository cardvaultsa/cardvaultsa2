import { Router, type IRouter } from "express";
import { sql, isNull, eq, and, desc, gte, or } from "drizzle-orm";
import {
  db,
  cardsTable,
  sealedProductsTable,
  priceSnapshotsTable,
  collectionValueHistoryTable,
} from "@workspace/db";

const router: IRouter = Router();

type TcgApiResponse = {
  data?: Array<{
    tcgplayer?: {
      prices?: Record<string, { market?: number }>;
    };
  }>;
};

type FetchJsonResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Fetch latest prices from Pokemon TCG API for a card name + set. */
async function fetchTcgPrice(name: string, set: string): Promise<number | null> {
  try {
    const q = encodeURIComponent(`name:"${name}" set.name:"${set}"`);
    const url = `https://api.pokemontcg.io/v2/cards?q=${q}&select=id,name,tcgplayer&pageSize=10`;
    const apiResponse = (await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "PokéVault/1.0" },
    })) as FetchJsonResponse;
    if (!apiResponse.ok) return null;
    const data = (await apiResponse.json()) as TcgApiResponse;
    const cards = data.data ?? [];
    if (!cards.length) return null;

    // Try common price keys in order of preference
    const priceKeys = ["holofoil", "reverseHolofoil", "normal", "1stEditionHolofoil", "unlimitedHolofoil"];
    for (const card of cards) {
      const prices = card.tcgplayer?.prices ?? {};
      for (const key of priceKeys) {
        const market = prices[key]?.market;
        if (market != null && market > 0) return market;
      }
      // Fallback: first available market price
      for (const priceData of Object.values(prices)) {
        if (priceData?.market && priceData.market > 0) return priceData.market;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Compute current portfolio value from card + sealed market values. */
async function computeCurrentValue() {
  const [cardVal] = await db.select({
    cardsValue: sql<number>`coalesce(sum(market_value::numeric * quantity), 0)`,
    cardCount: sql<number>`count(*)::int`,
  }).from(cardsTable).where(
    and(isNull(cardsTable.deletedAt), sql`status NOT IN ('sold', 'wishlist')`)
  );

  const [sealedVal] = await db.select({
    sealedValue: sql<number>`coalesce(sum(market_value::numeric * quantity), 0)`,
    sealedCount: sql<number>`count(*)::int`,
  }).from(sealedProductsTable).where(
    and(isNull(sealedProductsTable.deletedAt), sql`status NOT IN ('sold', 'wishlist')`)
  );

  const [costData] = await db.select({
    totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
  }).from(cardsTable).where(isNull(cardsTable.deletedAt));

  const [sealedCostData] = await db.select({
    totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
  }).from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt));

  const cardsValue = Number(cardVal.cardsValue);
  const sealedValue = Number(sealedVal.sealedValue);
  const totalValue = cardsValue + sealedValue;
  const cardCount = Number(cardVal.cardCount);
  const sealedCount = Number(sealedVal.sealedCount);
  const itemCount = cardCount + sealedCount;
  const totalCostBasis = Number(costData.totalCost) + Number(sealedCostData.totalCost);

  return { totalValue, cardsValue, sealedValue, itemCount, cardCount, sealedCount, totalCostBasis };
}

// ─── GET /market/summary ────────────────────────────────────────────────────

router.get("/market/summary", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { totalValue, cardsValue, sealedValue, itemCount, totalCostBasis } = await computeCurrentValue();

  // Fetch recent history snapshots for period comparisons
  const historyRows = await db
    .select()
    .from(collectionValueHistoryTable)
    .orderBy(desc(collectionValueHistoryTable.snapshotDate))
    .limit(32);

  const byDate = new Map(historyRows.map((h) => [h.snapshotDate, Number(h.totalValue)]));

  function prevValue(daysBack: number): number | null {
    const d = daysAgo(daysBack);
    // Find closest snapshot on or before that date
    const candidates = historyRows.filter((h) => h.snapshotDate <= d);
    if (!candidates.length) return null;
    return Number(candidates[0].totalValue);
  }

  const prev1d = prevValue(1);
  const prev7d = prevValue(7);
  const prev30d = prevValue(30);

  const change1d = prev1d != null ? totalValue - prev1d : null;
  const change7d = prev7d != null ? totalValue - prev7d : null;
  const change30d = prev30d != null ? totalValue - prev30d : null;

  const change1dPct = (change1d != null && prev1d && prev1d > 0) ? (change1d / prev1d) * 100 : null;
  const change7dPct = (change7d != null && prev7d && prev7d > 0) ? (change7d / prev7d) * 100 : null;
  const change30dPct = (change30d != null && prev30d && prev30d > 0) ? (change30d / prev30d) * 100 : null;

  const unrealizedGain = totalValue - totalCostBasis;
  const unrealizedGainPct = totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : null;

  const lastSnapshotDate = historyRows.length > 0 ? historyRows[0].snapshotDate : null;

  res.json({
    currentValue: totalValue,
    cardsValue,
    sealedValue,
    itemCount,
    change1d,
    change1dPct,
    change7d,
    change7dPct,
    change30d,
    change30dPct,
    lastSnapshotDate,
    totalCostBasis,
    unrealizedGain,
    unrealizedGainPct,
  });
});

// ─── GET /market/history ────────────────────────────────────────────────────

router.get("/market/history", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const daysParam = Number(req.query.days ?? 30);
  const days = Math.min(Math.max(daysParam, 1), 365);
  const since = daysAgo(days);

  const rows = await db
    .select()
    .from(collectionValueHistoryTable)
    .where(gte(collectionValueHistoryTable.snapshotDate, since))
    .orderBy(collectionValueHistoryTable.snapshotDate);

  res.json(rows.map((h) => ({
    id: h.id,
    snapshotDate: h.snapshotDate,
    totalValue: Number(h.totalValue),
    cardsValue: Number(h.cardsValue),
    sealedValue: Number(h.sealedValue),
    itemCount: h.itemCount,
    cardCount: h.cardCount,
    sealedCount: h.sealedCount,
    createdAt: h.createdAt,
  })));
});

// ─── GET /market/top-items ──────────────────────────────────────────────────

router.get("/market/top-items", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limitParam = Number(req.query.limit ?? 20);
  const limit = Math.min(Math.max(limitParam, 1), 50);

  const topCards = await db
    .select({
      id: cardsTable.id,
      name: cardsTable.name,
      set: cardsTable.set,
      cardNumber: cardsTable.cardNumber,
      rarity: cardsTable.rarity,
      marketValue: cardsTable.marketValue,
      purchasePrice: cardsTable.purchasePrice,
      coverImagePath: cardsTable.coverImagePath,
      status: cardsTable.status,
      quantity: cardsTable.quantity,
    })
    .from(cardsTable)
    .where(and(isNull(cardsTable.deletedAt), sql`market_value IS NOT NULL AND market_value::numeric > 0`))
    .orderBy(sql`market_value::numeric * quantity desc`)
    .limit(limit);

  const topSealed = await db
    .select({
      id: sealedProductsTable.id,
      name: sealedProductsTable.name,
      set: sealedProductsTable.set,
      marketValue: sealedProductsTable.marketValue,
      purchasePrice: sealedProductsTable.purchasePrice,
      coverImagePath: sealedProductsTable.coverImagePath,
      status: sealedProductsTable.status,
      quantity: sealedProductsTable.quantity,
    })
    .from(sealedProductsTable)
    .where(and(isNull(sealedProductsTable.deletedAt), sql`market_value IS NOT NULL AND market_value::numeric > 0`))
    .orderBy(sql`market_value::numeric * quantity desc`)
    .limit(limit);

  const combined = [
    ...topCards.map((c) => ({
      id: c.id,
      itemType: "card" as const,
      name: c.name,
      set: c.set ?? null,
      cardNumber: c.cardNumber ?? null,
      rarity: c.rarity ?? null,
      marketValue: Number(c.marketValue),
      purchasePrice: c.purchasePrice != null ? Number(c.purchasePrice) : null,
      gain: (c.purchasePrice != null && c.marketValue != null) ? (Number(c.marketValue) - Number(c.purchasePrice)) * (c.quantity ?? 1) : null,
      gainPct: (c.purchasePrice != null && c.marketValue != null && Number(c.purchasePrice) > 0)
        ? ((Number(c.marketValue) - Number(c.purchasePrice)) / Number(c.purchasePrice)) * 100
        : null,
      coverImagePath: c.coverImagePath ?? null,
      status: c.status ?? "collection",
      quantity: c.quantity ?? 1,
    })),
    ...topSealed.map((p) => ({
      id: p.id,
      itemType: "sealed_product" as const,
      name: p.name,
      set: p.set ?? null,
      cardNumber: null,
      rarity: null,
      marketValue: Number(p.marketValue),
      purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
      gain: (p.purchasePrice != null && p.marketValue != null) ? (Number(p.marketValue) - Number(p.purchasePrice)) * (p.quantity ?? 1) : null,
      gainPct: (p.purchasePrice != null && p.marketValue != null && Number(p.purchasePrice) > 0)
        ? ((Number(p.marketValue) - Number(p.purchasePrice)) / Number(p.purchasePrice)) * 100
        : null,
      coverImagePath: p.coverImagePath ?? null,
      status: p.status ?? "collection",
      quantity: p.quantity ?? 1,
    })),
  ]
    .sort((a, b) => b.marketValue * b.quantity - a.marketValue * a.quantity)
    .slice(0, limit);

  res.json(combined);
});

// ─── GET /market/movers ─────────────────────────────────────────────────────

router.get("/market/movers", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const windowDays = 7;
  const cutoff = daysAgo(windowDays);

  // Get all items with at least one snapshot older than cutoff
  const oldSnapshots = await db
    .select()
    .from(priceSnapshotsTable)
    .where(sql`snapshot_date <= ${cutoff}`)
    .orderBy(priceSnapshotsTable.snapshotDate);

  // Group by item, get oldest snapshot in window
  const oldByCard = new Map<number, number>();
  const oldBySealed = new Map<number, number>();
  for (const snap of oldSnapshots) {
    if (snap.cardId != null && !oldByCard.has(snap.cardId)) {
      oldByCard.set(snap.cardId, Number(snap.marketValue));
    }
    if (snap.sealedProductId != null && !oldBySealed.has(snap.sealedProductId)) {
      oldBySealed.set(snap.sealedProductId, Number(snap.marketValue));
    }
  }

  const cardIds = [...oldByCard.keys()];
  const sealedIds = [...oldBySealed.keys()];

  if (cardIds.length === 0 && sealedIds.length === 0) {
    res.json({ gainers: [], losers: [], windowDays });
    return;
  }

  // Get current values
  const cards = cardIds.length > 0
    ? await db.select({
        id: cardsTable.id, name: cardsTable.name, set: cardsTable.set,
        marketValue: cardsTable.marketValue, coverImagePath: cardsTable.coverImagePath,
      }).from(cardsTable).where(sql`id = ANY(${cardIds})`)
    : [];

  const sealeds = sealedIds.length > 0
    ? await db.select({
        id: sealedProductsTable.id, name: sealedProductsTable.name, set: sealedProductsTable.set,
        marketValue: sealedProductsTable.marketValue, coverImagePath: sealedProductsTable.coverImagePath,
      }).from(sealedProductsTable).where(sql`id = ANY(${sealedIds})`)
    : [];

  const movers = [
    ...cards
      .filter((c) => c.marketValue != null)
      .map((c) => {
        const prev = oldByCard.get(c.id)!;
        const curr = Number(c.marketValue);
        const change = curr - prev;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        return { id: c.id, itemType: "card" as const, name: c.name, set: c.set ?? null, currentValue: curr, previousValue: prev, change, changePct, coverImagePath: c.coverImagePath ?? null };
      }),
    ...sealeds
      .filter((p) => p.marketValue != null)
      .map((p) => {
        const prev = oldBySealed.get(p.id)!;
        const curr = Number(p.marketValue);
        const change = curr - prev;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        return { id: p.id, itemType: "sealed_product" as const, name: p.name, set: p.set ?? null, currentValue: curr, previousValue: prev, change, changePct, coverImagePath: p.coverImagePath ?? null };
      }),
  ];

  const sorted = movers.sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.filter((m) => m.change > 0).slice(0, 5);
  const losers = sorted.filter((m) => m.change < 0).reverse().slice(0, 5);

  res.json({ gainers, losers, windowDays });
});

// ─── POST /market/snapshot ──────────────────────────────────────────────────

router.post("/market/snapshot", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { totalValue, cardsValue, sealedValue, itemCount, cardCount, sealedCount } = await computeCurrentValue();
  const date = today();

  const [snapshot] = await db
    .insert(collectionValueHistoryTable)
    .values({
      snapshotDate: date,
      totalValue: String(totalValue),
      cardsValue: String(cardsValue),
      sealedValue: String(sealedValue),
      itemCount,
      cardCount,
      sealedCount,
    })
    .onConflictDoUpdate({
      target: collectionValueHistoryTable.snapshotDate,
      set: {
        totalValue: String(totalValue),
        cardsValue: String(cardsValue),
        sealedValue: String(sealedValue),
        itemCount,
        cardCount,
        sealedCount,
      },
    })
    .returning();

  res.status(201).json({
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    totalValue: Number(snapshot.totalValue),
    cardsValue: Number(snapshot.cardsValue),
    sealedValue: Number(snapshot.sealedValue),
    itemCount: snapshot.itemCount,
    cardCount: snapshot.cardCount,
    sealedCount: snapshot.sealedCount,
    createdAt: snapshot.createdAt,
  });
});

// ─── POST /market/refresh-prices ────────────────────────────────────────────

router.post("/market/refresh-prices", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const date = today();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process active (non-sold, non-wishlist) cards
  const cards = await db
    .select({ id: cardsTable.id, name: cardsTable.name, set: cardsTable.set, cardNumber: cardsTable.cardNumber, marketValue: cardsTable.marketValue })
    .from(cardsTable)
    .where(and(isNull(cardsTable.deletedAt), sql`status NOT IN ('sold', 'wishlist')`));

  for (const card of cards) {
    try {
      const apiPrice = await fetchTcgPrice(card.name, card.set);
      if (apiPrice != null) {
        await db.update(cardsTable).set({ marketValue: String(apiPrice), updatedAt: new Date() }).where(eq(cardsTable.id, card.id));
        await db.insert(priceSnapshotsTable).values({
          cardId: card.id, sealedProductId: null,
          marketValue: String(apiPrice), source: "api", snapshotDate: date,
        });
        updated++;
      } else {
        // Still record existing market_value as a snapshot for history continuity
        const mv = card.marketValue;
        if (mv != null) {
          await db.insert(priceSnapshotsTable).values({
            cardId: card.id, sealedProductId: null,
            marketValue: mv, source: "manual", snapshotDate: date,
          });
        }
        skipped++;
      }
    } catch {
      errors++;
    }
  }

  // Process active sealed products
  const sealeds = await db
    .select({ id: sealedProductsTable.id, name: sealedProductsTable.name, set: sealedProductsTable.set, marketValue: sealedProductsTable.marketValue })
    .from(sealedProductsTable)
    .where(and(isNull(sealedProductsTable.deletedAt), sql`status NOT IN ('sold', 'wishlist')`));

  for (const product of sealeds) {
    try {
      const apiPrice = await fetchTcgPrice(product.name, product.set ?? "");
      if (apiPrice != null) {
        await db.update(sealedProductsTable).set({ marketValue: String(apiPrice), updatedAt: new Date() }).where(eq(sealedProductsTable.id, product.id));
        await db.insert(priceSnapshotsTable).values({
          cardId: null, sealedProductId: product.id,
          marketValue: String(apiPrice), source: "api", snapshotDate: date,
        });
        updated++;
      } else {
        const mv = product.marketValue;
        if (mv != null) {
          await db.insert(priceSnapshotsTable).values({
            cardId: null, sealedProductId: product.id,
            marketValue: mv, source: "manual", snapshotDate: date,
          });
        }
        skipped++;
      }
    } catch {
      errors++;
    }
  }

  // Always take a portfolio snapshot after refresh
  const { totalValue, cardsValue, sealedValue, itemCount, cardCount, sealedCount } = await computeCurrentValue();
  await db.insert(collectionValueHistoryTable).values({
    snapshotDate: date,
    totalValue: String(totalValue),
    cardsValue: String(cardsValue),
    sealedValue: String(sealedValue),
    itemCount, cardCount, sealedCount,
  }).onConflictDoUpdate({
    target: collectionValueHistoryTable.snapshotDate,
    set: { totalValue: String(totalValue), cardsValue: String(cardsValue), sealedValue: String(sealedValue), itemCount, cardCount, sealedCount },
  });

  res.json({
    updated,
    skipped,
    errors,
    snapshotCreated: true,
    message: `Updated ${updated} prices from API, recorded ${skipped} manual snapshots${errors > 0 ? `, ${errors} errors` : ""}.`,
  });
});

// ─── GET /market/price-history/:itemType/:itemId ─────────────────────────────

router.get("/market/price-history/:itemType/:itemId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { itemType, itemId } = req.params;
  const daysParam = Number(req.query.days ?? 30);
  const days = Math.min(Math.max(daysParam, 1), 365);
  const since = daysAgo(days);

  if (itemType !== "card" && itemType !== "sealed_product") {
    res.status(400).json({ error: "itemType must be card or sealed_product" });
    return;
  }

  const id = parseInt(itemId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid itemId" }); return; }

  const rows = await db
    .select()
    .from(priceSnapshotsTable)
    .where(and(
      itemType === "card" ? eq(priceSnapshotsTable.cardId, id) : eq(priceSnapshotsTable.sealedProductId, id),
      gte(priceSnapshotsTable.snapshotDate, since),
    ))
    .orderBy(priceSnapshotsTable.snapshotDate);

  res.json(rows.map((r) => ({
    id: r.id,
    snapshotDate: r.snapshotDate,
    marketValue: Number(r.marketValue),
    source: r.source,
  })));
});

export default router;
