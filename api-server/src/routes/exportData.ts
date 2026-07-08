import { Router, type IRouter } from "express";
import { isNull, and, sql } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable, expensesTable, customersTable, localPickupsTable } from "@workspace/db";

const router: IRouter = Router();

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "(no records)\n";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

router.get("/export/csv", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const type = (req.query.type as string) || "all";
  let content = "";
  let filename = "pokevault-export";

  if (type === "cards" || type === "all") {
    const rows = await db.select().from(cardsTable).where(isNull(cardsTable.deletedAt)).orderBy(cardsTable.createdAt);
    if (type === "all") content += "=== CARDS ===\n";
    content += toCSV(rows.map((c) => ({
      id: c.id, name: c.name, set: c.set, cardNumber: c.cardNumber,
      rarity: c.rarity, condition: c.condition, grade: c.grade, grader: c.grader,
      quantity: c.quantity, purchasePrice: c.purchasePrice, marketValue: c.marketValue,
      askingPrice: c.askingPrice, soldPrice: c.soldPrice, soldDate: c.soldDate,
      status: c.status, location: c.location, notes: c.notes,
      createdAt: String(c.createdAt),
    }))) + "\n\n";
    if (type === "cards") filename = "pokevault-cards";
  }

  if (type === "sealed" || type === "all") {
    const rows = await db.select().from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt)).orderBy(sealedProductsTable.createdAt);
    if (type === "all") content += "=== SEALED PRODUCTS ===\n";
    content += toCSV(rows.map((p) => ({
      id: p.id, name: p.name, productType: p.productType, set: p.set,
      quantity: p.quantity, condition: p.condition, purchasePrice: p.purchasePrice,
      marketValue: p.marketValue, askingPrice: p.askingPrice, soldPrice: p.soldPrice,
      soldDate: p.soldDate, status: p.status, location: p.location, notes: p.notes,
      createdAt: String(p.createdAt),
    }))) + "\n\n";
    if (type === "sealed") filename = "pokevault-sealed";
  }

  if (type === "expenses" || type === "all") {
    const rows = await db.select().from(expensesTable).orderBy(expensesTable.date);
    if (type === "all") content += "=== EXPENSES ===\n";
    content += toCSV(rows.map((e) => ({
      id: e.id, category: e.category, description: e.description,
      amount: e.amount, date: e.date, notes: e.notes, createdAt: String(e.createdAt),
    }))) + "\n\n";
    if (type === "expenses") filename = "pokevault-expenses";
  }

  if (type === "customers" || type === "all") {
    const rows = await db.select().from(customersTable).orderBy(customersTable.name);
    if (type === "all") content += "=== CUSTOMERS ===\n";
    content += toCSV(rows.map((c) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      preferences: c.preferences, notes: c.notes, followUpDate: c.followUpDate,
      createdAt: String(c.createdAt),
    }))) + "\n\n";
    if (type === "customers") filename = "pokevault-customers";
  }

  if (type === "all") {
    const rows = await db.select().from(localPickupsTable).orderBy(localPickupsTable.createdAt);
    content += "=== PICKUPS ===\n";
    content += toCSV(rows.map((p) => ({
      id: p.id, buyerName: p.buyerName, location: p.location,
      meetingDatetime: p.meetingDatetime ? String(p.meetingDatetime) : null,
      itemDescription: p.itemDescription, amountDue: p.amountDue,
      amountPaid: p.amountPaid, status: p.status, notes: p.notes,
      createdAt: String(p.createdAt),
    }))) + "\n";
  }

  if (type === "portfolio") {
    const [cards, sealed] = await Promise.all([
      db.select().from(cardsTable).where(isNull(cardsTable.deletedAt)).orderBy(cardsTable.set, cardsTable.name),
      db.select().from(sealedProductsTable).where(isNull(sealedProductsTable.deletedAt)).orderBy(sealedProductsTable.set, sealedProductsTable.name),
    ]);
    content += toCSV([
      ...cards.map((c) => {
        const pp = c.purchasePrice ? Number(c.purchasePrice) : null;
        const mv = c.marketValue ? Number(c.marketValue) : null;
        const qty = c.quantity ?? 1;
        const gain = pp != null && mv != null ? (mv - pp) * qty : null;
        const gainPct = pp != null && mv != null && pp > 0 ? ((mv - pp) / pp) * 100 : null;
        return {
          itemType: "card", id: c.id, name: c.name, set: c.set, cardNumber: c.cardNumber ?? "",
          rarity: c.rarity ?? "", condition: c.condition ?? "", grade: c.grade ?? "",
          grader: c.grader ?? "", quantity: qty, status: c.status,
          purchasePrice: pp ?? "", marketValue: mv ?? "", askingPrice: c.askingPrice ? Number(c.askingPrice) : "",
          soldPrice: c.soldPrice ? Number(c.soldPrice) : "", soldDate: c.soldDate ?? "",
          purchaseDate: c.purchaseDate ?? "", purchaseSource: c.purchaseSource ?? "",
          unrealizedGain: gain ?? "", unrealizedGainPct: gainPct != null ? gainPct.toFixed(2) + "%" : "",
          location: c.location ?? "", notes: c.notes ?? "", createdAt: String(c.createdAt),
        };
      }),
      ...sealed.map((p) => {
        const pp = p.purchasePrice ? Number(p.purchasePrice) : null;
        const mv = p.marketValue ? Number(p.marketValue) : null;
        const qty = p.quantity ?? 1;
        const gain = pp != null && mv != null ? (mv - pp) * qty : null;
        const gainPct = pp != null && mv != null && pp > 0 ? ((mv - pp) / pp) * 100 : null;
        return {
          itemType: "sealed", id: p.id, name: p.name, set: p.set ?? "", cardNumber: "",
          rarity: "", condition: p.condition ?? "", grade: "", grader: "",
          quantity: qty, status: p.status,
          purchasePrice: pp ?? "", marketValue: mv ?? "", askingPrice: p.askingPrice ? Number(p.askingPrice) : "",
          soldPrice: p.soldPrice ? Number(p.soldPrice) : "", soldDate: p.soldDate ?? "",
          purchaseDate: p.purchaseDate ?? "", purchaseSource: p.purchaseSource ?? "",
          unrealizedGain: gain ?? "", unrealizedGainPct: gainPct != null ? gainPct.toFixed(2) + "%" : "",
          location: p.location ?? "", notes: p.notes ?? "", createdAt: String(p.createdAt),
        };
      }),
    ]);
    filename = "pokevault-portfolio";
  }

  if (type === "sold-performance") {
    const [soldCards, soldSealed] = await Promise.all([
      db.select().from(cardsTable)
        .where(and(isNull(cardsTable.deletedAt), sql`status = 'sold' and sold_price is not null`))
        .orderBy(sql`sold_date desc nulls last`),
      db.select().from(sealedProductsTable)
        .where(and(isNull(sealedProductsTable.deletedAt), sql`status = 'sold' and sold_price is not null`))
        .orderBy(sql`sold_date desc nulls last`),
    ]);
    content += toCSV([
      ...soldCards.map((c) => {
        const sp = c.soldPrice ? Number(c.soldPrice) : 0;
        const pp = c.purchasePrice ? Number(c.purchasePrice) : 0;
        const qty = c.quantity ?? 1;
        return {
          itemType: "card", id: c.id, name: c.name, set: c.set, cardNumber: c.cardNumber ?? "",
          condition: c.condition ?? "", grade: c.grade ?? "", quantity: qty,
          purchasePrice: pp, soldPrice: sp, soldDate: c.soldDate ?? "",
          profit: ((sp - pp) * qty).toFixed(2),
          profitPct: pp > 0 ? (((sp - pp) / pp) * 100).toFixed(2) + "%" : "",
          soldFor: (sp * qty).toFixed(2), costBasis: (pp * qty).toFixed(2),
        };
      }),
      ...soldSealed.map((p) => {
        const sp = p.soldPrice ? Number(p.soldPrice) : 0;
        const pp = p.purchasePrice ? Number(p.purchasePrice) : 0;
        const qty = p.quantity ?? 1;
        return {
          itemType: "sealed", id: p.id, name: p.name, set: p.set ?? "", cardNumber: "",
          condition: p.condition ?? "", grade: "", quantity: qty,
          purchasePrice: pp, soldPrice: sp, soldDate: p.soldDate ?? "",
          profit: ((sp - pp) * qty).toFixed(2),
          profitPct: pp > 0 ? (((sp - pp) / pp) * 100).toFixed(2) + "%" : "",
          soldFor: (sp * qty).toFixed(2), costBasis: (pp * qty).toFixed(2),
        };
      }),
    ]);
    filename = "pokevault-sold-performance";
  }

  if (type === "sets-summary") {
    const [cardsBySet, sealedBySet] = await Promise.all([
      db.select({
        set: cardsTable.set,
        cardCount: sql<number>`count(*)::int`,
        totalQuantity: sql<number>`coalesce(sum(quantity),0)::int`,
        totalCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
        totalMarketValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
      }).from(cardsTable).where(and(isNull(cardsTable.deletedAt), sql`status not in ('sold','wishlist')`))
        .groupBy(cardsTable.set).orderBy(cardsTable.set),
      db.select({
        set: sealedProductsTable.set,
        sealedCount: sql<number>`count(*)::int`,
        sealedQuantity: sql<number>`coalesce(sum(quantity),0)::int`,
        sealedCost: sql<number>`coalesce(sum(purchase_price::numeric * quantity), 0)`,
        sealedValue: sql<number>`coalesce(sum(coalesce(market_value,purchase_price)::numeric * quantity), 0)`,
      }).from(sealedProductsTable).where(and(isNull(sealedProductsTable.deletedAt), sql`status not in ('sold','wishlist')`))
        .groupBy(sealedProductsTable.set).orderBy(sealedProductsTable.set),
    ]);
    // Build set map — include sealed-only sets
    const setMap = new Map<string, { set: string; cardCount: number; sealedCount: number; totalQuantity: number; totalCost: number; totalValue: number }>();
    for (const c of cardsBySet) {
      setMap.set(c.set, { set: c.set, cardCount: Number(c.cardCount), sealedCount: 0, totalQuantity: Number(c.totalQuantity), totalCost: Number(c.totalCost), totalValue: Number(c.totalMarketValue) });
    }
    for (const s of sealedBySet) {
      const key = s.set ?? "(no set)";
      if (setMap.has(key)) {
        const row = setMap.get(key)!;
        row.sealedCount += Number(s.sealedCount);
        row.totalQuantity += Number(s.sealedQuantity);
        row.totalCost += Number(s.sealedCost);
        row.totalValue += Number(s.sealedValue);
      } else {
        setMap.set(key, { set: key, cardCount: 0, sealedCount: Number(s.sealedCount), totalQuantity: Number(s.sealedQuantity), totalCost: Number(s.sealedCost), totalValue: Number(s.sealedValue) });
      }
    }
    content += toCSV([...setMap.values()].sort((a, b) => a.set.localeCompare(b.set)).map((row) => {
      const gain = row.totalValue - row.totalCost;
      return {
        set: row.set, cards: row.cardCount, sealed: row.sealedCount,
        totalItems: row.cardCount + row.sealedCount, totalQuantity: row.totalQuantity,
        costBasis: row.totalCost.toFixed(2), marketValue: row.totalValue.toFixed(2),
        gain: gain.toFixed(2), gainPct: row.totalCost > 0 ? ((gain / row.totalCost) * 100).toFixed(2) + "%" : "",
      };
    }));
    filename = "pokevault-sets-summary";
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.send(content);
});

export default router;
