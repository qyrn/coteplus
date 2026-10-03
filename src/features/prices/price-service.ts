import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestPriority, RequestQueue } from "../../lib/net/request-queue";
import { RARITIES, type Rarity } from "../../lib/site/rarity";
import type { CardCatalog } from "../cards/card-catalog";
import type { TitledCardRef } from "../cards/card-ref";
import { type PriceSummary, parsePriceSummary, pickAveragePrice } from "./price-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_SUMMARY_TTL_MS = 14 * DAY_MS;
const PRICE_REFRESH_AFTER_MS = DAY_MS;
const BULK_LOAD_WORKERS = 4;

export interface AveragePrice {
	average: number | null;
	refreshed: Promise<number | null> | null;
}

export interface BulkLoadProgress {
	done: number;
	total: number;
	failed: number;
}

export interface BulkLoadOptions {
	signal: AbortSignal;
	onProgress: (progress: BulkLoadProgress) => void;
}

export interface PriceService {
	getAveragePrice(title: string, rarity: Rarity): Promise<AveragePrice>;
	loadAllOwnedPrices(options: BulkLoadOptions): Promise<BulkLoadProgress>;
}

function isFresh(storedAt: number): boolean {
	return Date.now() - storedAt <= PRICE_REFRESH_AFTER_MS;
}

function uniqueCardIdsByRarityDesc(cards: TitledCardRef[]): string[] {
	const sorted = [...cards].sort((left, right) => RARITIES.indexOf(right.rarity) - RARITIES.indexOf(left.rarity));
	return [...new Set(sorted.map((card) => card.cardId))];
}

export function createPriceService(queue: RequestQueue, catalog: CardCatalog): PriceService {
	const summaryStore = createTtlStore<PriceSummary>(CACHE_NAMESPACES.priceSummary);
	const inFlight = new Map<string, Promise<unknown>>();
	function once<TValue>(key: string, load: () => Promise<TValue>): Promise<TValue> {
		const existing = inFlight.get(key);
		if (existing) return existing as Promise<TValue>;
		const loading = load().finally(() => inFlight.delete(key));
		inFlight.set(key, loading);
		return loading;
	}

	function fetchSummary(cardId: string, priority: RequestPriority): Promise<PriceSummary> {
		return once(`summary:${cardId}`, async () => {
			const url = `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;
			const summary = parsePriceSummary(await queue.getJson(url, priority));
			await summaryStore.set(cardId, summary, PRICE_SUMMARY_TTL_MS);
			return summary;
		});
	}

	return {
		async getAveragePrice(title, rarity) {
			const cardId = (await catalog.resolve(title, rarity))?.cardId;
			if (!cardId) return { average: null, refreshed: null };
			const cached = await summaryStore.get(cardId);
			if (!cached) {
				return {
					average: pickAveragePrice(await fetchSummary(cardId, "visible"), rarity),
					refreshed: null,
				};
			}
			return {
				average: pickAveragePrice(cached.value, rarity),
				refreshed: isFresh(cached.storedAt)
					? null
					: fetchSummary(cardId, "background").then((summary) => pickAveragePrice(summary, rarity)),
			};
		},
		async loadAllOwnedPrices({ signal, onProgress }) {
			const cardIds = uniqueCardIdsByRarityDesc(await catalog.collectionIndexer.syncNow());
			const progress: BulkLoadProgress = { done: 0, total: cardIds.length, failed: 0 };
			onProgress({ ...progress });
			let nextIndex = 0;
			async function work(): Promise<void> {
				while (!signal.aborted && nextIndex < cardIds.length) {
					const cardId = cardIds[nextIndex++];
					if (cardId === undefined) return;
					const cached = await summaryStore.get(cardId);
					if (!cached || !isFresh(cached.storedAt)) {
						await fetchSummary(cardId, "background").catch(() => {
							progress.failed++;
						});
					}
					progress.done++;
					onProgress({ ...progress });
				}
			}
			await Promise.all(Array.from({ length: BULK_LOAD_WORKERS }, work));
			return { ...progress };
		},
	};
}
