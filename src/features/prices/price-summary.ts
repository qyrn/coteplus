import { isRecord } from "../../lib/json";
import { isRarity, RARITIES, type Rarity } from "../../lib/site/rarity";

export interface PriceStats {
	average: number;
	salesCount: number | null;
	latestPrice: number | null;
}

export type PriceSummary = Partial<Record<Rarity, number | PriceStats>>;

function readAmount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parsePriceSummary(json: unknown): PriceSummary {
	const summary = isRecord(json) && isRecord(json.summary) ? json.summary : {};
	const prices: PriceSummary = {};
	for (const [rarity, entry] of Object.entries(summary)) {
		if (!isRarity(rarity) || !isRecord(entry)) continue;
		const average = readAmount(entry.average);
		if (average === null) continue;
		prices[rarity] = { average, salesCount: readAmount(entry.count), latestPrice: readAmount(entry.latest) };
	}
	return prices;
}

function toStats(entry: number | PriceStats | undefined): PriceStats | null {
	if (entry === undefined) return null;
	return typeof entry === "number" ? { average: entry, salesCount: null, latestPrice: null } : entry;
}

export function pickPriceStats(summary: PriceSummary, rarity: Rarity): PriceStats | null {
	const sameRarity = toStats(summary[rarity]);
	if (sameRarity) return sameRarity;
	const known = RARITIES.map((candidate) => toStats(summary[candidate])).filter(
		(stats): stats is PriceStats => stats !== null,
	);
	return known.length === 1 ? (known[0] ?? null) : null;
}
