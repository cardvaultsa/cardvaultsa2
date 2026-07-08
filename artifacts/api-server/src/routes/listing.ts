import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, cardsTable, sealedProductsTable } from "@workspace/db";
import { GenerateListingBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/listing/generate", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = GenerateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { itemType, itemId } = parsed.data;

  if (itemType === "card") {
    const [card] = await db
      .select()
      .from(cardsTable)
      .where(and(eq(cardsTable.id, itemId), isNull(cardsTable.deletedAt)));

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const conditionPart = card.condition ? ` — ${card.condition}` : "";
    const gradePart =
      card.grade && card.grader
        ? ` — Graded ${card.grader} ${card.grade}`
        : card.grade
          ? ` — Grade: ${card.grade}`
          : "";
    const numberPart = card.cardNumber ? ` ${card.cardNumber}` : "";
    const rarityPart = card.rarity ? ` | ${card.rarity}` : "";
    const notesPart = card.notes ? `\n\n📝 ${card.notes}` : "";
    const qtyPart = card.quantity && card.quantity > 1 ? `\nQty available: ${card.quantity}` : "";

    const title = `${card.name} — ${card.set}${numberPart}${gradePart || conditionPart}`;

    const description = `🃏 ${card.name}
📦 Set: ${card.set}${numberPart}${rarityPart}${gradePart}${conditionPart}
${qtyPart}
💰 Asking: $${card.askingPrice ?? card.marketValue ?? "TBD"}

✅ From a smoke-free, pet-free home
📬 Shipping available — ask for rates
🤝 Local pickup welcome${notesPart}

DM with any questions!`;

    res.json({ title, description, price: card.askingPrice ? Number(card.askingPrice) : null });
    return;
  }

  // sealed_product
  const [product] = await db
    .select()
    .from(sealedProductsTable)
    .where(and(eq(sealedProductsTable.id, itemId), isNull(sealedProductsTable.deletedAt)));

  if (!product) {
    res.status(404).json({ error: "Sealed product not found" });
    return;
  }

  const typeName: Record<string, string> = {
    ETB: "Elite Trainer Box",
    booster_box: "Booster Box",
    booster_pack: "Booster Pack",
    tin: "Tin",
    binder: "Binder",
    case: "Case",
    other: "Sealed Product",
  };

  const setPart = product.set ? ` | Set: ${product.set}` : "";
  const conditionPart = product.condition ? ` | Condition: ${product.condition}` : "";
  const notesPart = product.notes ? `\n\n📝 ${product.notes}` : "";
  const qtyPart = product.quantity && product.quantity > 1
    ? `\nQty available: ${product.quantity}`
    : "";

  const title = `${product.name} — ${typeName[product.productType] ?? product.productType}`;

  const description = `📦 ${product.name}
🏷️ Type: ${typeName[product.productType] ?? product.productType}${setPart}${conditionPart}
${qtyPart}
💰 Asking: $${product.askingPrice ?? product.marketValue ?? "TBD"}

✅ Sealed & unopened
✅ From a smoke-free, pet-free home
📬 Shipping available — ask for rates
🤝 Local pickup welcome${notesPart}

DM with any questions!`;

  res.json({ title, description, price: product.askingPrice ? Number(product.askingPrice) : null });
});

export default router;
