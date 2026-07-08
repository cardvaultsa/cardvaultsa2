import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, itemImagesTable } from "@workspace/db";
import {
  ListCardImagesParams,
  AddCardImageParams,
  AddCardImageBody,
  DeleteCardImageParams,
  ListSealedProductImagesParams,
  AddSealedProductImageParams,
  AddSealedProductImageBody,
  DeleteSealedProductImageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Card images
router.get("/cards/:id/images", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListCardImagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const images = await db
    .select()
    .from(itemImagesTable)
    .where(eq(itemImagesTable.cardId, params.data.id))
    .orderBy(itemImagesTable.sortOrder);

  res.json(images);
});

router.post("/cards/:id/images", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AddCardImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCardImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [image] = await db
    .insert(itemImagesTable)
    .values({
      cardId: params.data.id,
      objectPath: parsed.data.objectPath,
      label: parsed.data.label as "front" | "back" | "damage" | "receipt" | "sealed" | "other",
      caption: parsed.data.caption ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(image);
});

router.delete("/cards/:id/images/:imageId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCardImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [image] = await db
    .delete(itemImagesTable)
    .where(
      and(
        eq(itemImagesTable.id, params.data.imageId),
        eq(itemImagesTable.cardId, params.data.id),
      ),
    )
    .returning();

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  res.sendStatus(204);
});

// Sealed product images
router.get("/sealed-products/:id/images", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListSealedProductImagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const images = await db
    .select()
    .from(itemImagesTable)
    .where(eq(itemImagesTable.sealedProductId, params.data.id))
    .orderBy(itemImagesTable.sortOrder);

  res.json(images);
});

router.post("/sealed-products/:id/images", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AddSealedProductImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddSealedProductImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [image] = await db
    .insert(itemImagesTable)
    .values({
      sealedProductId: params.data.id,
      objectPath: parsed.data.objectPath,
      label: parsed.data.label as "front" | "back" | "damage" | "receipt" | "sealed" | "other",
      caption: parsed.data.caption ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(image);
});

router.delete(
  "/sealed-products/:id/images/:imageId",
  async (req, res): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const params = DeleteSealedProductImageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [image] = await db
      .delete(itemImagesTable)
      .where(
        and(
          eq(itemImagesTable.id, params.data.imageId),
          eq(itemImagesTable.sealedProductId, params.data.id),
        ),
      )
      .returning();

    if (!image) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
