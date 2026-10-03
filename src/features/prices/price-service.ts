import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestPriority, RequestQueue } from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import type { CardCatalog } from "../cards/card-catalog";
import { type PriceSummary, parsePriceSummary, pickAveragePrice } from "./price-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_SUMMARY_TTL_MS = 30 * DAY_MS;
const PRICE_REFRESH_AFTER_MS = 3 * DAY_MS;

export interface AveragePrice {
	average: number | null;
	refreshed: Promise<number | null> | null;
}

export interface PricedCardKey {
	cardId: string;
	rarity: Rarity;
}

export interface PriceService {
	getAveragePrice(title: string, rarity: Rarity): Promise<AveragePrice>;
	cachedAverages(cards: readonly PricedCardKey[]): Promise<Map<string, number>>;
}

function isFresh(storedAt: number): boolean {
	return Date.now() - storedAt <= PRICE_REFRESH_AFTER_MS;
}

export function createPriceService(queue: RequestQueue, catalog: CardCatalog): PriceService {
	const summaryStore = createTtlStore<PriceSummary>(CACHE_NAMESPACES.priceSummary);
	const inFlight = new Map<string, Promise<PriceSummary>>();

	function fetchSummary(cardId: string, priority: RequestPriority): Promise<PriceSummary> {
		const existing = inFlight.get(cardId);
		if (existing) return existing;
		const loading = (async () => {
			const url = `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;
			const summary = parsePriceSummary(await queue.getJson(url, priority));
			await summaryStore.set(cardId, summary, PRICE_SUMMARY_TTL_MS);
			return summary;
		})().finally(() => inFlight.delete(cardId));
		inFlight.set(cardId, loading);
		return loading;
	}

	return {
		async cachedAverages(cards) {
			const summaries = await summaryStore.getMany(cards.map((card) => card.cardId));
			const averages = new Map<string, number>();
			for (const card of cards) {
				const summary = summaries.get(card.cardId);
				const average = summary ? pickAveragePrice(summary.value, card.rarity) : null;
				if (average !== null) averages.set(card.cardId, average);
			}
			return averages;
		},
		async getAveragePrice(title, rarity) {
			const cardId = (await catalog.resolve(title, rarity))?.cardId;
			if (!cardId) return { average: null, refreshed: null };
			const cached = await summaryStore.get(cardId);
			if (!cached) {
				return { average: pickAveragePrice(await fetchSummary(cardId, "visible"), rarity), refreshed: null };
			}
			return {
				average: pickAveragePrice(cached.value, rarity),
				refreshed: isFresh(cached.storedAt)
					? null
					: fetchSummary(cardId, "background").then((summary) => pickAveragePrice(summary, rarity)),
			};
		},
	};
}
