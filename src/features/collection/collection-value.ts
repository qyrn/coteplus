import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { RARITIES, type Rarity } from "../../lib/site/rarity";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceStats } from "../prices/price-summary";
import { isExactRarity } from "./collection-sample";

export interface CollectionValue {
	total: number;
	byRarity: Partial<Record<Rarity, number>>;
	pricedCards: number;
	estimatedCards: number;
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

function sampleAverages(
	owned: readonly OwnedCard[],
	coteOf: (card: OwnedCard) => number,
	sampleCardIds: ReadonlySet<string>,
): Map<Rarity, number> {
	const cotesByRarity = new Map<Rarity, number[]>();
	for (const card of owned) {
		const cote = coteOf(card);
		if (!sampleCardIds.has(card.cardId) || cote <= 0) continue;
		cotesByRarity.set(card.rarity, [...(cotesByRarity.get(card.rarity) ?? []), cote]);
	}
	return new Map(
		[...cotesByRarity].map(([rarity, cotes]) => [rarity, cotes.reduce((sum, cote) => sum + cote, 0) / cotes.length]),
	);
}

export function computeCollectionValue(
	owned: readonly OwnedCard[],
	statsOf: (card: OwnedCard) => PriceStats | null,
	sampleCardIds: ReadonlySet<string>,
): CollectionValue {
	const coteOf = (card: OwnedCard): number => statsOf(card)?.value ?? 0;
	const averages = sampleAverages(owned, coteOf, sampleCardIds);
	const byRarity: Partial<Record<Rarity, number>> = {};
	let total = 0;
	let pricedCards = 0;
	let estimatedCards = 0;
	for (const card of owned) {
		const cote = coteOf(card);
		const estimate = isExactRarity(card.rarity) ? 0 : (averages.get(card.rarity) ?? 0);
		const unitValue = cote > 0 ? cote : estimate;
		if (unitValue <= 0) continue;
		if (cote > 0) pricedCards += 1;
		else estimatedCards += 1;
		const cardValue = unitValue * card.copies;
		total += cardValue;
		byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + cardValue;
	}
	return { total: Math.round(total), byRarity, pricedCards, estimatedCards, ownedCards: owned.length };
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
