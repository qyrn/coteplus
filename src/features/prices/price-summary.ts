import { isRecord } from "../../lib/json";
import { isRarity, RARITIES, type Rarity } from "../../lib/site/rarity";

export type PriceSummary = Partial<Record<Rarity, number>>;

export function parsePriceSummary(json: unknown): PriceSummary {
	const summary = isRecord(json) && isRecord(json.summary) ? json.summary : {};
	const prices: PriceSummary = {};
	for (const [rarity, entry] of Object.entries(summary)) {
		if (!isRarity(rarity) || !isRecord(entry)) continue;
		const average = entry.average;
		if (typeof average === "number" && Number.isFinite(average) && average >= 0)
			prices[rarity] = average;
	}
	return prices;
}

export function pickAveragePrice(
	summary: PriceSummary,
	rarity: Rarity,
): number | null {
	const sameRarity = summary[rarity];
	if (sameRarity !== undefined) return sameRarity;
	const knownPrices = RARITIES.map((candidate) => summary[candidate]).filter(
		(price): price is number => price !== undefined,
	);
	return knownPrices.length === 1 ? (knownPrices[0] ?? null) : null;
}
