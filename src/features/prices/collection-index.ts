import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import { normalizeTitle } from "../../lib/site/card-dom";
import { isRarity, type Rarity } from "../../lib/site/rarity";

export interface OwnedCardRef {
	cardId: string;
	title: string;
	rarity: Rarity;
}

export interface CollectionPage {
	cards: OwnedCardRef[];
	total: number | null;
}

export interface CollectionIndexer {
	syncIfStale(): Promise<void>;
	syncNow(): Promise<OwnedCardRef[]>;
	whenIdle(): Promise<void>;
}

const COLLECTION_PAGE_SIZE = 50;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const lastSyncedAt = storage.defineItem<number>("local:collection-index-synced-at", { fallback: 0 });

function readOwnedCard(row: unknown): OwnedCardRef | null {
	if (!isRecord(row) || !isRecord(row.card)) return null;
	const { id, wikipedia_title: title, rarity } = row.card;
	if (typeof id !== "string" || typeof title !== "string" || typeof rarity !== "string" || !isRarity(rarity)) {
		return null;
	}
	return { cardId: id, title: normalizeTitle(title), rarity };
}

export function parseCollectionPage(json: unknown): CollectionPage {
	if (!isRecord(json)) return { cards: [], total: null };
	const rows = Array.isArray(json.collection) ? json.collection : [];
	return {
		cards: rows.map(readOwnedCard).filter((card): card is OwnedCardRef => card !== null),
		total: typeof json.total === "number" ? json.total : null,
	};
}

export function collectionPageUrl(page: number): string {
	return `/api/my-collection?sort=rarity&page=${page}&stats=${page === 0 ? 1 : 0}`;
}

export function createCollectionIndexer(
	queue: RequestQueue,
	saveCards: (cards: OwnedCardRef[]) => Promise<void>,
): CollectionIndexer {
	let runningSync: Promise<unknown> | null = null;

	async function loadPage(page: number): Promise<CollectionPage> {
		const collectionPage = parseCollectionPage(await queue.getJson(collectionPageUrl(page)));
		await saveCards(collectionPage.cards);
		return collectionPage;
	}

	async function sync(): Promise<OwnedCardRef[]> {
		const firstPage = await loadPage(0);
		const pageCount = Math.ceil((firstPage.total ?? 0) / COLLECTION_PAGE_SIZE);
		const remainingPages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 1);
		const otherPages = await Promise.all(remainingPages.map(loadPage));
		await lastSyncedAt.setValue(Date.now());
		return [firstPage, ...otherPages].flatMap((page) => page.cards);
	}

	function track<TValue>(work: Promise<TValue>): Promise<TValue> {
		const tracked = work.finally(() => {
			if (runningSync === tracked) runningSync = null;
		});
		runningSync = tracked;
		return tracked;
	}

	return {
		async syncIfStale() {
			if (runningSync) {
				await runningSync;
				return;
			}
			await track(
				(async () => {
					if (Date.now() - (await lastSyncedAt.getValue()) < SYNC_INTERVAL_MS) return;
					await sync();
				})(),
			);
		},
		async syncNow() {
			await runningSync?.catch(() => undefined);
			return track(sync());
		},
		async whenIdle() {
			await runningSync?.catch(() => undefined);
		},
	};
}
