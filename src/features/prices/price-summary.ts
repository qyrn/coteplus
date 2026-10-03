import { isRecord } from "../../lib/json";
import { isRarity, RARITIES, type Rarity } from "../../lib/site/rarity";

export type PriceBasis = "recent" | "all-time";

export interface PriceStats {
	value: number;
	basis: PriceBasis;
	low: number | null;
	high: number | null;
	salesCount: number | null;
	latestPrice: number | null;
}

export type PriceSheet = Partial<Record<Rarity, PriceStats>>;

export type LegacyPriceSummary = Partial<Record<Rarity, unknown>>;

function readAmount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function allTimeStats(average: number, salesCount: number | null, latestPrice: number | null): PriceStats {
	return { value: average, basis: "all-time", low: null, high: null, salesCount, latestPrice };
}

export function parsePriceSummary(json: unknown): PriceSheet {
	const summary = isRecord(json) && isRecord(json.summary) ? json.summary : {};
	const sheet: PriceSheet = {};
	for (const [rarity, entry] of Object.entries(summary)) {
		if (!isRarity(rarity) || !isRecord(entry)) continue;
		const average = readAmount(entry.average);
		if (average !== null) sheet[rarity] = allTimeStats(average, readAmount(entry.count), readAmount(entry.latest));
	}
	return sheet;
}

function readCachedStats(entry: unknown): PriceStats | null {
	const legacyAverage = readAmount(entry);
	if (legacyAverage !== null) return allTimeStats(legacyAverage, null, null);
	if (!isRecord(entry)) return null;
	const value = readAmount(entry.value);
	if (value !== null && (entry.basis === "recent" || entry.basis === "all-time")) {
		return {
			value,
			basis: entry.basis,
			low: readAmount(entry.low),
			high: readAmount(entry.high),
			salesCount: readAmount(entry.salesCount),
			latestPrice: readAmount(entry.latestPrice),
		};
	}
	const average = readAmount(entry.average);
	return average === null ? null : allTimeStats(average, readAmount(entry.salesCount), readAmount(entry.latestPrice));
}

export function pickPriceStats(sheet: LegacyPriceSummary, rarity: Rarity): PriceStats | null {
	const sameRarity = readCachedStats(sheet[rarity]);
	if (sameRarity) return sameRarity;
	const known = RARITIES.map((candidate) => readCachedStats(sheet[candidate])).filter(
		(stats): stats is PriceStats => stats !== null,
	);
	return known.length === 1 ? (known[0] ?? null) : null;
}
