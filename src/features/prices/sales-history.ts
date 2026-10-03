import { isRecord } from "../../lib/json";
import { isRarity, RARITIES, type Rarity } from "../../lib/site/rarity";
import type { PriceSheet, PriceStats } from "./price-summary";

export interface Sale {
	price: number;
	rarity: Rarity;
	settledAt: number;
}

const RECENT_SALES_COUNT = 20;
const RECENCY_DECAY = 0.9;
const OUTLIER_FENCE = 1.5;
const MIN_SALES_FOR_RANGE = 3;

function readSale(entry: unknown): Sale | null {
	if (!isRecord(entry)) return null;
	const { final_price: price, rarity, settled_at: settledAtText } = entry;
	const settledAt = typeof settledAtText === "string" ? Date.parse(settledAtText) : Number.NaN;
	if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
	if (typeof rarity !== "string" || !isRarity(rarity) || !Number.isFinite(settledAt)) return null;
	return { price, rarity, settledAt };
}

export function hasSalesHistory(json: unknown): boolean {
	return isRecord(json) && (Array.isArray(json.sales) || Array.isArray(json.recent));
}

export function parseSales(json: unknown): Sale[] {
	if (!isRecord(json)) return [];
	const entries = Array.isArray(json.sales) ? json.sales : Array.isArray(json.recent) ? json.recent : [];
	return entries.map(readSale).filter((sale): sale is Sale => sale !== null);
}

function quantile(sortedPrices: readonly number[], share: number): number {
	const position = (sortedPrices.length - 1) * share;
	const below = sortedPrices[Math.floor(position)] ?? 0;
	const above = sortedPrices[Math.ceil(position)] ?? below;
	return below + (above - below) * (position - Math.floor(position));
}

function withoutOutliers(sales: readonly Sale[]): Sale[] {
	const prices = sales.map((sale) => sale.price).sort((left, right) => left - right);
	const lowerQuartile = quantile(prices, 0.25);
	const upperQuartile = quantile(prices, 0.75);
	const fence = (upperQuartile - lowerQuartile) * OUTLIER_FENCE;
	return sales.filter((sale) => sale.price >= lowerQuartile - fence && sale.price <= upperQuartile + fence);
}

function weightedQuantile(weightedPrices: ReadonlyArray<{ price: number; weight: number }>, share: number): number {
	const sorted = [...weightedPrices].sort((left, right) => left.price - right.price);
	const total = sorted.reduce((sum, entry) => sum + entry.weight, 0);
	let cumulated = 0;
	for (const entry of sorted) {
		cumulated += entry.weight;
		if (cumulated >= total * share) return entry.price;
	}
	return sorted.at(-1)?.price ?? 0;
}

export function estimateCote(sales: readonly Sale[], rarity: Rarity): PriceStats | null {
	const sameRarity = sales
		.filter((sale) => sale.rarity === rarity)
		.sort((left, right) => right.settledAt - left.settledAt);
	const latest = sameRarity[0];
	if (!latest) return null;
	const recent = sameRarity.slice(0, RECENT_SALES_COUNT);
	const kept = recent.length >= MIN_SALES_FOR_RANGE ? withoutOutliers(recent) : recent;
	const weighted = kept.map((sale) => ({ price: sale.price, weight: RECENCY_DECAY ** recent.indexOf(sale) }));
	const hasRange = kept.length >= MIN_SALES_FOR_RANGE;
	return {
		value: Math.round(weightedQuantile(weighted, 0.5)),
		basis: "recent",
		low: hasRange ? Math.round(weightedQuantile(weighted, 0.25)) : null,
		high: hasRange ? Math.round(weightedQuantile(weighted, 0.75)) : null,
		salesCount: sameRarity.length,
		latestPrice: latest.price,
	};
}

export function coteSheet(sales: readonly Sale[]): PriceSheet {
	const sheet: PriceSheet = {};
	for (const rarity of RARITIES) {
		const stats = estimateCote(sales, rarity);
		if (stats) sheet[rarity] = stats;
	}
	return sheet;
}
