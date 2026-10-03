import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestQueue, StillWanted } from "../../lib/net/request-queue";
import type { Rarity } from "../../lib/site/rarity";
import type { CardRef, TitledCardRef } from "./card-ref";
import { catalogSearchUrl, findCardInSearch } from "./catalog-search";
import { type CollectionIndexer, createCollectionIndexer } from "./collection-index";

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_REF_TTL_MS = 180 * DAY_MS;
const UNKNOWN_CARD_TTL_MS = DAY_MS;

interface CardLookup {
	card: CardRef | null;
}

export interface CardCatalog {
	collectionIndexer: CollectionIndexer;
	resolve(title: string, rarity: Rarity, isWanted?: StillWanted): Promise<CardRef | null>;
	learnFrom(loading: Promise<TitledCardRef[]>): void;
}

function cardKey(title: string, rarity: Rarity): string {
	return `${rarity}:${title}`;
}

export function createCardCatalog(queue: RequestQueue): CardCatalog {
	const lookupStore = createTtlStore<CardLookup>(CACHE_NAMESPACES.cardRefByTitle);
	const inFlight = new Map<string, Promise<CardRef | null>>();
	const pendingLearning = new Set<Promise<void>>();

	function remember(cards: TitledCardRef[]): Promise<void> {
		return lookupStore.setMany(
			cards.map(
				(card) =>
					[cardKey(card.title, card.rarity), { card: { cardId: card.cardId, hideImage: card.hideImage } }] as const,
			),
			CARD_REF_TTL_MS,
		);
	}

	const collectionIndexer = createCollectionIndexer(queue, remember);

	async function lookup(title: string, rarity: Rarity, isWanted?: StillWanted): Promise<CardRef | null> {
		const key = cardKey(title, rarity);
		await Promise.all([collectionIndexer.whenIdle(), ...pendingLearning]);
		const cached = await lookupStore.get(key);
		if (cached) return cached.value.card;
		const card = findCardInSearch(await queue.getJson(catalogSearchUrl(title), "visible", isWanted), title, rarity);
		await lookupStore.set(key, { card }, card ? CARD_REF_TTL_MS : UNKNOWN_CARD_TTL_MS);
		return card;
	}

	return {
		collectionIndexer,
		resolve(title, rarity, isWanted) {
			const key = cardKey(title, rarity);
			const existing = inFlight.get(key);
			if (existing) return existing;
			const resolving = lookup(title, rarity, isWanted).finally(() => inFlight.delete(key));
			inFlight.set(key, resolving);
			return resolving;
		},
		learnFrom(loading) {
			const learning: Promise<void> = loading
				.then(remember)
				.catch(() => undefined)
				.finally(() => pendingLearning.delete(learning));
			pendingLearning.add(learning);
		},
	};
}
