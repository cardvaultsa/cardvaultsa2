import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

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
  set?: { name?: string };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number }>;
  };
}

function outputText(data: unknown): string {
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

function parseGuess(text: string): VisionCardGuess {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/);
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

async function identifyWithOpenAi(imageDataUrl: string): Promise<VisionCardGuess> {
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
    const message =
      (data as { error?: { message?: string } } | null)?.error?.message ??
      `OpenAI vision request failed with HTTP ${response.status}.`;
    throw Object.assign(new Error(message), { statusCode: 502 });
  }

  return parseGuess(outputText(data));
}

function quotePokemonQuery(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function scoreCandidate(card: PokemonTcgCard, guess: VisionCardGuess): number {
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

function marketValue(card: PokemonTcgCard): number | null {
  const prices = card.tcgplayer?.prices ?? {};
  for (const price of Object.values(prices)) {
    if (typeof price.market === "number" && price.market > 0) return price.market;
  }
  for (const price of Object.values(prices)) {
    if (typeof price.mid === "number" && price.mid > 0) return price.mid;
  }
  return null;
}

async function searchPokemonTcg(guess: VisionCardGuess): Promise<PokemonTcgCard[]> {
  if (!guess.name) return [];

  const queryParts = [`name:${quotePokemonQuery(guess.name)}`];
  if (guess.cardNumber) queryParts.push(`number:${quotePokemonQuery(guess.cardNumber)}`);

  const queries = [queryParts.join(" "), `name:${quotePokemonQuery(guess.name)}`];
  const seen = new Set<string>();
  const results: PokemonTcgCard[] = [];

  for (const query of queries) {
    const url =
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}` +
      "&select=id,name,number,rarity,set,images,tcgplayer&pageSize=12";
    const headers: Record<string, string> = { "User-Agent": "PokeVault/1.0" };
    if (process.env.POKEMON_TCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;

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
    .sort((a, b) => scoreCandidate(b, guess) - scoreCandidate(a, guess))
    .slice(0, 5);
}

router.post("/identify-photo", async (req, res): Promise<void> => {
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
    const guess = await identifyWithOpenAi(parsed.data.imageDataUrl);
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
        marketValue: marketValue(card),
        score: scoreCandidate(card, guess),
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Card photo identification failed");
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Card photo identification failed.",
    });
  }
});

export default router;
