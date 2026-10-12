import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { RARITIES, type Rarity } from "../../lib/site/rarity";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceStats } from "../prices/price-summary";

export interface CollectionValue {
	total: number;
	byRarity: Partial<Record<Rarity, number>>;
	pricedCards: number;
	ownedCards: number;
}

export interface ValuePoint {
	day: string;
	total: number;
	pricedCards: number;
	ownedCards: number;
}

const HISTORY_LIMIT = 365;

export const collectionValueHistoryItem = storage.defineItem<unknown>("local:collection-value-history", {
	fallback: [],
});

export function computeCollectionValue(
	owned: readonly OwnedCard[],
	statsOf: (card: OwnedCard) => PriceStats | null,
): CollectionValue {
	const byRarity: Partial<Record<Rarity, number>> = {};
	let total = 0;
	let pricedCards = 0;
	for (const card of owned) {
		const cote = statsOf(card)?.value ?? 0;
		if (cote <= 0) continue;
		const cardValue = cote * card.copies;
		total += cardValue;
		pricedCards += 1;
		byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + cardValue;
	}
	return { total: Math.round(total), byRarity, pricedCards, ownedCards: owned.length };
}

export function dayKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function isValuePoint(value: unknown): value is ValuePoint {
	return (
		isRecord(value) &&
		typeof value.day === "string" &&
		typeof value.total === "number" &&
		typeof value.pricedCards === "number" &&
		typeof value.ownedCards === "number"
	);
}

export function readValueHistory(value: unknown): ValuePoint[] {
	return Array.isArray(value) ? value.filter(isValuePoint) : [];
}

export function recordValuePoint(history: readonly ValuePoint[], point: ValuePoint): ValuePoint[] {
	return [...history.filter((existing) => existing.day !== point.day), point]
		.sort((left, right) => left.day.localeCompare(right.day))
		.slice(-HISTORY_LIMIT);
}

export function raritiesByValue(value: CollectionValue): [Rarity, number][] {
	return RARITIES.flatMap((rarity): [Rarity, number][] => {
		const amount = value.byRarity[rarity];
		return amount ? [[rarity, Math.round(amount)]] : [];
	}).sort((left, right) => right[1] - left[1]);
}

export interface UnpricedEstimate {
	total: number;
	cards: number;
}

function median(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function estimateUnpricedValue(
	owned: readonly OwnedCard[],
	statsOf: (card: OwnedCard) => PriceStats | null,
): UnpricedEstimate {
	const cotesByRarity = new Map<Rarity, number[]>();
	const unpriced: OwnedCard[] = [];
	for (const card of owned) {
		const cote = statsOf(card)?.value ?? 0;
		if (cote <= 0) {
			unpriced.push(card);
			continue;
		}
		cotesByRarity.set(card.rarity, [...(cotesByRarity.get(card.rarity) ?? []), cote]);
	}
	const medianByRarity = new Map(RARITIES.map((rarity) => [rarity, median(cotesByRarity.get(rarity) ?? [])]));
	let total = 0;
	let cards = 0;
	for (const card of unpriced) {
		const typicalCote = medianByRarity.get(card.rarity);
		if (!typicalCote) continue;
		total += typicalCote * card.copies;
		cards += 1;
	}
	return { total: Math.round(total), cards };
}
