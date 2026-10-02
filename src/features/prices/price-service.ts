import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type {
	RequestPriority,
	RequestQueue,
} from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import { catalogSearchUrl, findCardIdInSearch } from "./catalog-search";
import {
	type CollectionIndexer,
	createCollectionIndexer,
	type OwnedCardRef,
} from "./collection-index";
import {
	type PriceSummary,
	parsePriceSummary,
	pickAveragePrice,
} from "./price-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_ID_TTL_MS = 180 * DAY_MS;
const UNKNOWN_CARD_TTL_MS = DAY_MS;
const PRICE_SUMMARY_TTL_MS = 14 * DAY_MS;
const PRICE_REFRESH_AFTER_MS = DAY_MS;

interface CardIdLookup {
	cardId: string | null;
}

export interface AveragePrice {
	average: number | null;
	refreshed: Promise<number | null> | null;
}

export interface PriceService {
	collectionIndexer: CollectionIndexer;
	getAveragePrice(title: string, rarity: Rarity): Promise<AveragePrice>;
}

function cardKey(title: string, rarity: Rarity): string {
	return `${rarity}:${title}`;
}

export function createPriceService(queue: RequestQueue): PriceService {
	const cardIdStore = createTtlStore<CardIdLookup>(
		CACHE_NAMESPACES.cardIdByTitle,
	);
	const summaryStore = createTtlStore<PriceSummary>(
		CACHE_NAMESPACES.priceSummary,
	);
	const inFlight = new Map<string, Promise<unknown>>();
	const collectionIndexer = createCollectionIndexer(
		queue,
		(cards: OwnedCardRef[]) =>
			cardIdStore.setMany(
				cards.map(
					(card) =>
						[
							cardKey(card.title, card.rarity),
							{ cardId: card.cardId },
						] as const,
				),
				CARD_ID_TTL_MS,
			),
	);

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
		const key = cardKey(title, rarity);
		return once(`id:${key}`, async () => {
			await collectionIndexer.whenIdle();
			const cached = await cardIdStore.get(key);
			if (cached) return cached.value.cardId;
			const cardId = findCardIdInSearch(
				await queue.getJson(catalogSearchUrl(title)),
				title,
				rarity,
			);
			await cardIdStore.set(
				key,
				{ cardId },
				cardId ? CARD_ID_TTL_MS : UNKNOWN_CARD_TTL_MS,
			);
			return cardId;
		});
	}

	function fetchSummary(
		cardId: string,
		priority: RequestPriority,
	): Promise<PriceSummary> {
		return once(`summary:${cardId}`, async () => {
			const url = `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;
			const summary = parsePriceSummary(await queue.getJson(url, priority));
			await summaryStore.set(cardId, summary, PRICE_SUMMARY_TTL_MS);
			return summary;
		});
	}

	return {
		collectionIndexer,
		async getAveragePrice(title, rarity) {
			const cardId = await resolveCardId(title, rarity);
			if (!cardId) return { average: null, refreshed: null };
			const cached = await summaryStore.get(cardId);
			if (!cached) {
				return {
					average: pickAveragePrice(
						await fetchSummary(cardId, "visible"),
						rarity,
					),
					refreshed: null,
				};
			}
			const isStale = Date.now() - cached.storedAt > PRICE_REFRESH_AFTER_MS;
			return {
				average: pickAveragePrice(cached.value, rarity),
				refreshed: isStale
					? fetchSummary(cardId, "background").then((summary) =>
							pickAveragePrice(summary, rarity),
						)
					: null,
			};
		},
	};
}
