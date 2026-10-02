import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import { catalogSearchUrl, findCardIdInSearch } from "./catalog-search";
import {
	type PriceSummary,
	parsePriceSummary,
	pickAveragePrice,
} from "./price-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_ID_TTL_MS = 30 * DAY_MS;
const UNKNOWN_CARD_TTL_MS = DAY_MS;
const PRICE_SUMMARY_TTL_MS = DAY_MS;

interface CardIdLookup {
	cardId: string | null;
}

export interface PriceService {
	getAveragePrice(title: string, rarity: Rarity): Promise<number | null>;
}

export function createPriceService(queue: RequestQueue): PriceService {
	const cardIdStore = createTtlStore<CardIdLookup>(
		CACHE_NAMESPACES.cardIdByTitle,
	);
	const summaryStore = createTtlStore<PriceSummary>(
		CACHE_NAMESPACES.priceSummary,
	);
	const inFlight = new Map<string, Promise<unknown>>();

	function once<TValue>(
		key: string,
		load: () => Promise<TValue>,
	): Promise<TValue> {
		const existing = inFlight.get(key);
		if (existing) return existing as Promise<TValue>;
		const loading = load().finally(() => inFlight.delete(key));
		inFlight.set(key, loading);
		return loading;
	}

	function resolveCardId(
		title: string,
		rarity: Rarity,
	): Promise<string | null> {
		const cacheId = `${rarity}:${title}`;
		return once(`id:${cacheId}`, async () => {
			const cached = await cardIdStore.get(cacheId);
			if (cached) return cached.cardId;
			const cardId = findCardIdInSearch(
				await queue.getJson(catalogSearchUrl(title)),
				title,
				rarity,
			);
			await cardIdStore.set(
				cacheId,
				{ cardId },
				cardId ? CARD_ID_TTL_MS : UNKNOWN_CARD_TTL_MS,
			);
			return cardId;
		});
	}

	function loadSummary(cardId: string): Promise<PriceSummary> {
		return once(`summary:${cardId}`, async () => {
			const cached = await summaryStore.get(cardId);
			if (cached) return cached;
			const url = `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;
			const summary = parsePriceSummary(await queue.getJson(url));
			await summaryStore.set(cardId, summary, PRICE_SUMMARY_TTL_MS);
			return summary;
		});
	}

	return {
		async getAveragePrice(title, rarity) {
			const cardId = await resolveCardId(title, rarity);
			if (!cardId) return null;
			return pickAveragePrice(await loadSummary(cardId), rarity);
		},
	};
}
