import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestPriority, RequestQueue, StillWanted } from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import type { CardCatalog } from "../cards/card-catalog";
import {
	type LegacyPriceSummary,
	type PriceSheet,
	type PriceStats,
	parsePriceSummary,
	pickPriceStats,
} from "./price-summary";
import { coteSheet, hasSalesHistory, parseSales } from "./sales-history";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_TTL_MS = 30 * DAY_MS;
const PRICE_REFRESH_AFTER_MS = 3 * DAY_MS;

export interface PriceLookup {
	value: number | null;
	stats: PriceStats | null;
	refreshed: Promise<PriceStats | null> | null;
}

export interface PricedCardKey {
	cardId: string;
	rarity: Rarity;
}

export interface PriceService {
	getPrice(title: string, rarity: Rarity, isWanted?: StillWanted): Promise<PriceLookup>;
	cachedPriceStats(cards: readonly PricedCardKey[]): Promise<Map<string, PriceStats>>;
}

function isFresh(storedAt: number): boolean {
	return Date.now() - storedAt <= PRICE_REFRESH_AFTER_MS;
}

function salesUrl(cardId: string): string {
	return `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales`;
}

export function createPriceService(queue: RequestQueue, catalog: CardCatalog): PriceService {
	const sheetStore = createTtlStore<PriceSheet>(CACHE_NAMESPACES.priceCote);
	const legacyStore = createTtlStore<LegacyPriceSummary>(CACHE_NAMESPACES.legacyPriceSummary);
	const inFlight = new Map<string, Promise<PriceSheet>>();

	async function downloadSheet(cardId: string, priority: RequestPriority, isWanted?: StillWanted): Promise<PriceSheet> {
		const json = await queue.getJson(salesUrl(cardId), priority, isWanted);
		if (hasSalesHistory(json)) return coteSheet(parseSales(json));
		const summary = parsePriceSummary(json);
		if (Object.keys(summary).length > 0) return summary;
		return parsePriceSummary(await queue.getJson(`${salesUrl(cardId)}?scope=summary`, priority, isWanted));
	}

	function fetchSheet(cardId: string, priority: RequestPriority, isWanted?: StillWanted): Promise<PriceSheet> {
		const existing = inFlight.get(cardId);
		if (existing) return existing;
		const loading = (async () => {
			const sheet = await downloadSheet(cardId, priority, isWanted);
			await sheetStore.set(cardId, sheet, PRICE_TTL_MS);
			return sheet;
		})().finally(() => inFlight.delete(cardId));
		inFlight.set(cardId, loading);
		return loading;
	}

	function refreshInBackground(cardId: string, rarity: Rarity, isWanted?: StillWanted): Promise<PriceStats | null> {
		return fetchSheet(cardId, "background", isWanted).then((sheet) => pickPriceStats(sheet, rarity));
	}

	return {
		async cachedPriceStats(cards) {
			const cardIds = cards.map((card) => card.cardId);
			const [sheets, legacySummaries] = await Promise.all([sheetStore.getMany(cardIds), legacyStore.getMany(cardIds)]);
			const found = new Map<string, PriceStats>();
			for (const card of cards) {
				const sheet = sheets.get(card.cardId)?.value ?? legacySummaries.get(card.cardId)?.value;
				const stats = sheet ? pickPriceStats(sheet, card.rarity) : null;
				if (stats) found.set(card.cardId, stats);
			}
			return found;
		},
		async getPrice(title, rarity, isWanted) {
			const cardId = (await catalog.resolve(title, rarity, isWanted))?.cardId;
			if (!cardId) return { value: null, stats: null, refreshed: null };
			const cached = await sheetStore.get(cardId);
			if (cached) {
				const stats = pickPriceStats(cached.value, rarity);
				const refreshed = isFresh(cached.storedAt) ? null : refreshInBackground(cardId, rarity, isWanted);
				return { value: stats?.value ?? null, stats, refreshed };
			}
			const legacy = await legacyStore.get(cardId);
			if (legacy) {
				const stats = pickPriceStats(legacy.value, rarity);
				const refreshed = isFresh(legacy.storedAt) ? null : refreshInBackground(cardId, rarity, isWanted);
				return { value: stats?.value ?? null, stats, refreshed };
			}
			const stats = pickPriceStats(await fetchSheet(cardId, "visible", isWanted), rarity);
			return { value: stats?.value ?? null, stats, refreshed: null };
		},
	};
}
