import { Router, type IRouter } from "express";
import { eq, and, ilike, or, sql, isNull, asc, desc } from "drizzle-orm";
import { db, sealedProductsTable, itemImagesTable } from "@workspace/db";
import {
  ListSealedProductsQueryParams,
  CreateSealedProductBody,
  UpdateSealedProductBody,
  GetSealedProductParams,
  UpdateSealedProductParams,
  DeleteSealedProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type CardStatus = "collection" | "for_sale" | "sold" | "wishlist" | "trade_binder" | "grading_pile";

function sortColumn(sort: string | undefined) {
  switch (sort) {
    case "name": return sealedProductsTable.name;
    case "set": return sealedProductsTable.set;
    case "quantity": return sealedProductsTable.quantity;
    case "productType": return sealedProductsTable.productType;
    default: return sealedProductsTable.createdAt;
  }
}

router.get("/sealed-products", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const query = ListSealedProductsQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};

  const conditions = [isNull(sealedProductsTable.deletedAt)];

  if (filters.search)
    conditions.push(
      or(
        ilike(sealedProductsTable.name, `%${filters.search}%`),
        ilike(sealedProductsTable.set ?? sql`''`, `%${filters.search}%`),
        ilike(sealedProductsTable.notes ?? sql`''`, `%${filters.search}%`),
      ) as ReturnType<typeof isNull>,
    );
  if (filters.status)
    conditions.push(eq(sealedProductsTable.status, filters.status as CardStatus) as ReturnType<typeof isNull>);
  if (filters.location)
    conditions.push(ilike(sealedProductsTable.location ?? sql`''`, `%${filters.location}%`) as ReturnType<typeof isNull>);
  if (filters.productType)
    conditions.push(
      eq(
        sealedProductsTable.productType,
        filters.productType as "ETB" | "booster_box" | "booster_pack" | "tin" | "binder" | "case" | "other",
      ) as ReturnType<typeof isNull>,
    );
  if ((filters as Record<string, string>).set)
    conditions.push(ilike(sealedProductsTable.set ?? sql`''`, `%${(filters as Record<string, string>).set}%`) as ReturnType<typeof isNull>);
  if ((filters as Record<string, string>).condition)
    conditions.push(ilike(sealedProductsTable.condition ?? sql`''`, `%${(filters as Record<string, string>).condition}%`) as ReturnType<typeof isNull>);

  const col = sortColumn((filters as Record<string, string>).sort);
  const dir = (filters as Record<string, string>).order === "asc" ? asc : desc;

  const products = await db
    .select()
    .from(sealedProductsTable)
    .where(and(...conditions))
    .orderBy(dir(col));

  res.json(
    products.map((p) => ({
      ...p,
      purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
      marketValue: p.marketValue != null ? Number(p.marketValue) : null,
      askingPrice: p.askingPrice != null ? Number(p.askingPrice) : null,
      soldPrice: p.soldPrice != null ? Number(p.soldPrice) : null,
    })),
  );
});

router.post("/sealed-products", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateSealedProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { purchasePrice, marketValue, askingPrice, purchaseDate, ...rest } = parsed.data;
  const toDateStr = (d: Date | string | null | undefined) =>
    d instanceof Date ? d.toISOString().split("T")[0] : (d ?? null);

  const [product] = await db
    .insert(sealedProductsTable)
    .values({
      ...rest,
      purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
      marketValue: marketValue != null ? String(marketValue) : null,
      askingPrice: askingPrice != null ? String(askingPrice) : null,
      purchaseDate: toDateStr(purchaseDate),
    })
    .returning();

  res.status(201).json({
    ...product,
    purchasePrice: product.purchasePrice != null ? Number(product.purchasePrice) : null,
    marketValue: product.marketValue != null ? Number(product.marketValue) : null,
    askingPrice: product.askingPrice != null ? Number(product.askingPrice) : null,
    soldPrice: product.soldPrice != null ? Number(product.soldPrice) : null,
  });
});

router.get("/sealed-products/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetSealedProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(sealedProductsTable)
    .where(and(eq(sealedProductsTable.id, params.data.id), isNull(sealedProductsTable.deletedAt)));

  if (!product) {
    res.status(404).json({ error: "Sealed product not found" });
    return;
  }

  const images = await db
    .select()
    .from(itemImagesTable)
    .where(eq(itemImagesTable.sealedProductId, product.id))
    .orderBy(itemImagesTable.sortOrder);

  res.json({
    ...product,
    purchasePrice: product.purchasePrice != null ? Number(product.purchasePrice) : null,
    marketValue: product.marketValue != null ? Number(product.marketValue) : null,
    askingPrice: product.askingPrice != null ? Number(product.askingPrice) : null,
    soldPrice: product.soldPrice != null ? Number(product.soldPrice) : null,
    images,
  });
});

router.patch("/sealed-products/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateSealedProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSealedProductBody.safeParse(req.body);
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

  const [product] = await db
    .update(sealedProductsTable)
    .set(updates)
    .where(and(eq(sealedProductsTable.id, params.data.id), isNull(sealedProductsTable.deletedAt)))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Sealed product not found" });
    return;
  }

  res.json({
    ...product,
    purchasePrice: product.purchasePrice != null ? Number(product.purchasePrice) : null,
    marketValue: product.marketValue != null ? Number(product.marketValue) : null,
    askingPrice: product.askingPrice != null ? Number(product.askingPrice) : null,
    soldPrice: product.soldPrice != null ? Number(product.soldPrice) : null,
  });
});

router.delete("/sealed-products/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteSealedProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .update(sealedProductsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sealedProductsTable.id, params.data.id), isNull(sealedProductsTable.deletedAt)))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Sealed product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
