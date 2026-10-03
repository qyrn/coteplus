import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestPriority, RequestQueue, StillWanted } from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import type { CardCatalog } from "../cards/card-catalog";
import { type PriceStats, type PriceSummary, parsePriceSummary, pickPriceStats } from "./price-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_SUMMARY_TTL_MS = 30 * DAY_MS;
const PRICE_REFRESH_AFTER_MS = 3 * DAY_MS;

export interface AveragePrice {
	average: number | null;
	stats: PriceStats | null;
	refreshed: Promise<PriceStats | null> | null;
}

export interface PricedCardKey {
	cardId: string;
	rarity: Rarity;
}

export interface PriceService {
	getAveragePrice(title: string, rarity: Rarity, isWanted?: StillWanted): Promise<AveragePrice>;
	cachedPriceStats(cards: readonly PricedCardKey[]): Promise<Map<string, PriceStats>>;
}

function isFresh(storedAt: number): boolean {
	return Date.now() - storedAt <= PRICE_REFRESH_AFTER_MS;
}

export function createPriceService(queue: RequestQueue, catalog: CardCatalog): PriceService {
	const summaryStore = createTtlStore<PriceSummary>(CACHE_NAMESPACES.priceSummary);
	const inFlight = new Map<string, Promise<PriceSummary>>();

	function fetchSummary(cardId: string, priority: RequestPriority, isWanted?: StillWanted): Promise<PriceSummary> {
		const existing = inFlight.get(cardId);
		if (existing) return existing;
		const loading = (async () => {
			const url = `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;
			const summary = parsePriceSummary(await queue.getJson(url, priority, isWanted));
			await summaryStore.set(cardId, summary, PRICE_SUMMARY_TTL_MS);
			return summary;
		})().finally(() => inFlight.delete(cardId));
		inFlight.set(cardId, loading);
		return loading;
	}

	return {
		async cachedPriceStats(cards) {
			const summaries = await summaryStore.getMany(cards.map((card) => card.cardId));
			const found = new Map<string, PriceStats>();
			for (const card of cards) {
				const summary = summaries.get(card.cardId);
				const stats = summary ? pickPriceStats(summary.value, card.rarity) : null;
				if (stats) found.set(card.cardId, stats);
			}
			return found;
		},
		async getAveragePrice(title, rarity, isWanted) {
			const cardId = (await catalog.resolve(title, rarity, isWanted))?.cardId;
			if (!cardId) return { average: null, stats: null, refreshed: null };
			const cached = await summaryStore.get(cardId);
			const stats = pickPriceStats(cached ? cached.value : await fetchSummary(cardId, "visible", isWanted), rarity);
			return {
				average: stats?.average ?? null,
				stats,
				refreshed:
					!cached || isFresh(cached.storedAt)
						? null
						: fetchSummary(cardId, "background").then((summary) => pickPriceStats(summary, rarity)),
			};
		},
	};
}
