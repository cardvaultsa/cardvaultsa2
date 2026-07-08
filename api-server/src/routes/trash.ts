import { Router, type IRouter } from "express";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable, itemImagesTable } from "@workspace/db";
import { z } from "zod/v4";

const IdParam = z.object({ id: z.coerce.number().int().positive() });

const router: IRouter = Router();

router.get("/trash", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const cards = await db.select().from(cardsTable).where(isNotNull(cardsTable.deletedAt));
  const sealed = await db.select().from(sealedProductsTable).where(isNotNull(sealedProductsTable.deletedAt));

  const items = [
    ...cards.map((c) => ({
      id: c.id,
      name: c.name,
      type: "card" as const,
      status: c.status,
      coverImagePath: c.coverImagePath,
      deletedAt: c.deletedAt,
    })),
    ...sealed.map((p) => ({
      id: p.id,
      name: p.name,
      type: "sealed_product" as const,
      status: p.status,
      coverImagePath: p.coverImagePath,
      deletedAt: p.deletedAt,
    })),
  ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

  res.json(items);
});

router.post("/trash/cards/:id/restore", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [card] = await db
    .update(cardsTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(cardsTable.id, params.data.id), isNotNull(cardsTable.deletedAt)))
    .returning();

  if (!card) { res.status(404).json({ error: "Card not found in trash" }); return; }

  res.json({
    ...card,
    purchasePrice: card.purchasePrice != null ? Number(card.purchasePrice) : null,
    marketValue: card.marketValue != null ? Number(card.marketValue) : null,
    askingPrice: card.askingPrice != null ? Number(card.askingPrice) : null,
    soldPrice: card.soldPrice != null ? Number(card.soldPrice) : null,
  });
});

router.post("/trash/sealed-products/:id/restore", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [product] = await db
    .update(sealedProductsTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(sealedProductsTable.id, params.data.id), isNotNull(sealedProductsTable.deletedAt)))
    .returning();

  if (!product) { res.status(404).json({ error: "Sealed product not found in trash" }); return; }

  res.json({
    ...product,
    purchasePrice: product.purchasePrice != null ? Number(product.purchasePrice) : null,
    marketValue: product.marketValue != null ? Number(product.marketValue) : null,
    askingPrice: product.askingPrice != null ? Number(product.askingPrice) : null,
    soldPrice: product.soldPrice != null ? Number(product.soldPrice) : null,
  });
});

router.delete("/trash/cards/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [trashed] = await db
    .select({ id: cardsTable.id })
    .from(cardsTable)
    .where(and(eq(cardsTable.id, params.data.id), isNotNull(cardsTable.deletedAt)));

  if (!trashed) { res.status(404).json({ error: "Card not found in trash" }); return; }

  await db.delete(itemImagesTable).where(eq(itemImagesTable.cardId, params.data.id));
  await db.delete(cardsTable).where(eq(cardsTable.id, params.data.id));

  res.sendStatus(204);
});

router.delete("/trash/sealed-products/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [trashed] = await db
    .select({ id: sealedProductsTable.id })
    .from(sealedProductsTable)
    .where(and(eq(sealedProductsTable.id, params.data.id), isNotNull(sealedProductsTable.deletedAt)));

  if (!trashed) { res.status(404).json({ error: "Sealed product not found in trash" }); return; }

  await db.delete(itemImagesTable).where(eq(itemImagesTable.sealedProductId, params.data.id));
  await db.delete(sealedProductsTable).where(eq(sealedProductsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
