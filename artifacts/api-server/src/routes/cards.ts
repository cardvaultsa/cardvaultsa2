import { Router, type IRouter } from "express";
import { eq, and, ilike, or, sql, isNull, asc, desc } from "drizzle-orm";
import { db, cardsTable, itemImagesTable } from "@workspace/db";
import { z } from "zod";
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

const IdentifyCardPhotoBody = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i)
    .max(9_500_000),
});

interface VisionCardGuess {
  name?: string | null;
  set?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
}

interface PokemonTcgCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set?: { id?: string; name?: string; series?: string };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number }>;
  };
}

function sortColumn(sort: string | undefined) {
  switch (sort) {
    case "name": return cardsTable.name;
    case "set": return cardsTable.set;
    case "quantity": return cardsTable.quantity;
    case "rarity": return cardsTable.rarity;
    default: return cardsTable.createdAt;
  }
}

function getOpenAiOutputText(data: unknown): string {
  const root = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof root.output_text === "string") return root.output_text;
  const chunks: string[] = [];
  for (const item of root.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

function parseVisionGuess(text: string): VisionCardGuess {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  return {
    name: typeof parsed.name === "string" ? parsed.name.trim() : null,
    set: typeof parsed.set === "string" ? parsed.set.trim() : null,
    cardNumber:
      typeof parsed.cardNumber === "string"
        ? parsed.cardNumber.trim()
        : typeof parsed.number === "string"
          ? parsed.number.trim()
          : null,
    rarity: typeof parsed.rarity === "string" ? parsed.rarity.trim() : null,
  };
}

async function identifyCardWithVision(imageDataUrl: string): Promise<VisionCardGuess> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not configured."), {
      statusCode: 501,
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-5.6",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Identify this Pokemon trading card. Return only JSON with keys " +
                "name, set, cardNumber, rarity. Use null when uncertain.",
            },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      (data as { error?: { message?: string } } | null)?.error?.message ??
      `OpenAI vision request failed with HTTP ${response.status}.`;
    throw Object.assign(new Error(errorMessage), { statusCode: 502 });
  }

  return parseVisionGuess(getOpenAiOutputText(data));
}

function tcgMarketValue(card: PokemonTcgCard): number | null {
  const prices = card.tcgplayer?.prices ?? {};
  for (const price of Object.values(prices)) {
    if (typeof price.market === "number" && price.market > 0) return price.market;
  }
  for (const price of Object.values(prices)) {
    if (typeof price.mid === "number" && price.mid > 0) return price.mid;
  }
  return null;
}

function quotePokemonQuery(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function scorePokemonCandidate(card: PokemonTcgCard, guess: VisionCardGuess): number {
  let score = 0;
  const name = guess.name?.toLowerCase();
  const setName = guess.set?.toLowerCase();
  const cardNumber = guess.cardNumber?.toLowerCase();
  if (name && card.name.toLowerCase() === name) score += 50;
  else if (name && card.name.toLowerCase().includes(name)) score += 25;
  if (setName && card.set?.name?.toLowerCase().includes(setName)) score += 25;
  if (cardNumber && card.number?.toLowerCase() === cardNumber) score += 25;
  if (card.images?.small || card.images?.large) score += 5;
  return score;
}

async function searchPokemonTcg(guess: VisionCardGuess): Promise<PokemonTcgCard[]> {
  if (!guess.name) return [];

  const queryParts = [`name:${quotePokemonQuery(guess.name)}`];
  if (guess.cardNumber) queryParts.push(`number:${quotePokemonQuery(guess.cardNumber)}`);

  const queries = [
    queryParts.join(" "),
    `name:${quotePokemonQuery(guess.name)}`,
  ];
  const seen = new Set<string>();
  const results: PokemonTcgCard[] = [];

  for (const query of queries) {
    const url =
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}` +
      "&select=id,name,number,rarity,set,images,tcgplayer&pageSize=12";
    const headers: Record<string, string> = { "User-Agent": "PokeVault/1.0" };
    if (process.env.POKEMON_TCG_API_KEY) {
      headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) continue;
    const data = await response.json() as { data?: PokemonTcgCard[] };
    for (const card of data.data ?? []) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      results.push(card);
    }
  }

  return results
    .sort((a, b) => scorePokemonCandidate(b, guess) - scorePokemonCandidate(a, guess))
    .slice(0, 5);
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

router.post("/cards/identify-photo", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = IdentifyCardPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload a JPEG, PNG, or WebP card photo under 7 MB." });
    return;
  }

  try {
    const guess = await identifyCardWithVision(parsed.data.imageDataUrl);
    const candidates = await searchPokemonTcg(guess);
    res.json({
      guess,
      candidates: candidates.map((card) => ({
        id: card.id,
        name: card.name,
        set: card.set?.name ?? null,
        cardNumber: card.number ?? null,
        rarity: card.rarity ?? null,
        imageUrl: card.images?.small ?? card.images?.large ?? null,
        marketValue: tcgMarketValue(card),
        score: scorePokemonCandidate(card, guess),
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Card photo identification failed");
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    res.status(statusCode).json({
      error:
        error instanceof Error
          ? error.message
          : "Card photo identification failed.",
    });
  }
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
