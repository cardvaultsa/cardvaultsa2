import { Router, type IRouter } from "express";
import { eq, and, ilike, or, sql, isNull, asc, desc } from "drizzle-orm";
import { db, cardsTable, itemImagesTable } from "@workspace/db";
import {
  ListCardsQueryParams,
  CreateCardBody,
  UpdateCardBody,
  GetCardParams,
  UpdateCardParams,
  DeleteCardParams,
  BulkCreateCardsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

type CardStatus = "collection" | "for_sale" | "sold" | "wishlist" | "trade_binder" | "grading_pile";

function sortColumn(sort: string | undefined) {
  switch (sort) {
    case "name": return cardsTable.name;
    case "set": return cardsTable.set;
    case "quantity": return cardsTable.quantity;
    case "rarity": return cardsTable.rarity;
    default: return cardsTable.createdAt;
  }
}

router.get("/cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const query = ListCardsQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};

  const conditions = [isNull(cardsTable.deletedAt)];

  if (filters.search) {
    conditions.push(
      or(
        ilike(cardsTable.name, `%${filters.search}%`),
        ilike(cardsTable.set, `%${filters.search}%`),
        ilike(cardsTable.cardNumber ?? sql`''`, `%${filters.search}%`),
        ilike(cardsTable.notes ?? sql`''`, `%${filters.search}%`),
      ) as ReturnType<typeof isNull>,
    );
  }
  if (filters.set) conditions.push(ilike(cardsTable.set, `%${filters.set}%`) as ReturnType<typeof isNull>);
  if (filters.status)
    conditions.push(eq(cardsTable.status, filters.status as CardStatus) as ReturnType<typeof isNull>);
  if (filters.condition)
    conditions.push(ilike(cardsTable.condition ?? sql`''`, `%${filters.condition}%`) as ReturnType<typeof isNull>);
  if (filters.location)
    conditions.push(ilike(cardsTable.location ?? sql`''`, `%${filters.location}%`) as ReturnType<typeof isNull>);
  if (filters.rarity)
    conditions.push(ilike(cardsTable.rarity ?? sql`''`, `%${filters.rarity}%`) as ReturnType<typeof isNull>);

  const col = sortColumn((filters as Record<string, string>).sort);
  const dir = (filters as Record<string, string>).order === "asc" ? asc : desc;

  const cards = await db
    .select()
    .from(cardsTable)
    .where(and(...conditions))
    .orderBy(dir(col));

  res.json(
    cards.map((c) => ({
      ...c,
      purchasePrice: c.purchasePrice != null ? Number(c.purchasePrice) : null,
      marketValue: c.marketValue != null ? Number(c.marketValue) : null,
      askingPrice: c.askingPrice != null ? Number(c.askingPrice) : null,
      soldPrice: c.soldPrice != null ? Number(c.soldPrice) : null,
    })),
  );
});

router.post("/cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { purchasePrice, marketValue, askingPrice, purchaseDate, ...rest } = parsed.data;
  const toDateStr = (d: Date | string | null | undefined) =>
    d instanceof Date ? d.toISOString().split("T")[0] : (d ?? null);

  const [card] = await db
    .insert(cardsTable)
    .values({
      ...rest,
      purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
      marketValue: marketValue != null ? String(marketValue) : null,
      askingPrice: askingPrice != null ? String(askingPrice) : null,
      purchaseDate: toDateStr(purchaseDate),
    })
    .returning();

  res.status(201).json({
    ...card,
    purchasePrice: card.purchasePrice != null ? Number(card.purchasePrice) : null,
    marketValue: card.marketValue != null ? Number(card.marketValue) : null,
    askingPrice: card.askingPrice != null ? Number(card.askingPrice) : null,
    soldPrice: card.soldPrice != null ? Number(card.soldPrice) : null,
  });
});

router.get("/cards/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [card] = await db
    .select()
    .from(cardsTable)
    .where(and(eq(cardsTable.id, params.data.id), isNull(cardsTable.deletedAt)));

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const images = await db
    .select()
    .from(itemImagesTable)
    .where(eq(itemImagesTable.cardId, card.id))
    .orderBy(itemImagesTable.sortOrder);

  res.json({
    ...card,
    purchasePrice: card.purchasePrice != null ? Number(card.purchasePrice) : null,
    marketValue: card.marketValue != null ? Number(card.marketValue) : null,
    askingPrice: card.askingPrice != null ? Number(card.askingPrice) : null,
    soldPrice: card.soldPrice != null ? Number(card.soldPrice) : null,
    images,
  });
});

router.patch("/cards/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { purchasePrice, marketValue, askingPrice, soldPrice, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (purchasePrice !== undefined)
    updates.purchasePrice = purchasePrice != null ? String(purchasePrice) : null;
  if (marketValue !== undefined)
    updates.marketValue = marketValue != null ? String(marketValue) : null;
  if (askingPrice !== undefined)
    updates.askingPrice = askingPrice != null ? String(askingPrice) : null;
  if (soldPrice !== undefined)
    updates.soldPrice = soldPrice != null ? String(soldPrice) : null;

  const [card] = await db
    .update(cardsTable)
    .set(updates)
    .where(and(eq(cardsTable.id, params.data.id), isNull(cardsTable.deletedAt)))
    .returning();

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json({
    ...card,
    purchasePrice: card.purchasePrice != null ? Number(card.purchasePrice) : null,
    marketValue: card.marketValue != null ? Number(card.marketValue) : null,
    askingPrice: card.askingPrice != null ? Number(card.askingPrice) : null,
    soldPrice: card.soldPrice != null ? Number(card.soldPrice) : null,
  });
});

router.delete("/cards/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [card] = await db
    .update(cardsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cardsTable.id, params.data.id), isNull(cardsTable.deletedAt)))
    .returning();

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/cards/bulk", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = BulkCreateCardsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const toDateStr = (d: Date | string | null | undefined) =>
    d instanceof Date ? d.toISOString().split("T")[0] : (d ?? null);
  const values = parsed.data.cards.map(({ purchasePrice, marketValue, askingPrice, purchaseDate, ...rest }) => ({
    ...rest,
    purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
    marketValue: marketValue != null ? String(marketValue) : null,
    askingPrice: askingPrice != null ? String(askingPrice) : null,
    purchaseDate: toDateStr(purchaseDate),
  }));
  const cards = await db.insert(cardsTable).values(values).returning();
  res.status(201).json({ count: cards.length, ids: cards.map((c) => c.id) });
});

export default router;
