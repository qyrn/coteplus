import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import type { RequestPriority, RequestQueue } from "../../lib/net/request-queue";
import { normalizeTitle } from "../../lib/site/card-dom";
import { isRarity } from "../../lib/site/rarity";
import { readHideImage, type TitledCardRef } from "./card-ref";

export interface CollectionRow {
	card: TitledCardRef;
	starred: boolean;
}

export interface CollectionPage {
	rows: CollectionRow[];
	total: number | null;
}

export interface OwnedCard extends TitledCardRef {
	copies: number;
	starredCopies: number;
}

export interface CollectionIndexer {
	syncIfStale(): Promise<void>;
	whenIdle(): Promise<void>;
}

const COLLECTION_PAGE_SIZE = 50;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const lastSyncedAt = storage.defineItem<number>("local:collection-index-synced-at", { fallback: 0 });

export const ownedCardsItem = storage.defineItem<OwnedCard[]>("local:owned-cards", { fallback: [] });

function readCollectionRow(row: unknown): CollectionRow | null {
	if (!isRecord(row) || !isRecord(row.card)) return null;
	const { id, wikipedia_title: title, rarity } = row.card;
	if (typeof id !== "string" || typeof title !== "string" || typeof rarity !== "string" || !isRarity(rarity)) {
		return null;
	}
	return {
		card: { cardId: id, hideImage: readHideImage(row.card), title: normalizeTitle(title), rarity },
		starred: row.starred === true,
	};
}

export function parseCollectionPage(json: unknown): CollectionPage {
	if (!isRecord(json)) return { rows: [], total: null };
	const rows = Array.isArray(json.collection) ? json.collection : [];
	return {
		rows: rows.map(readCollectionRow).filter((row): row is CollectionRow => row !== null),
		total: typeof json.total === "number" ? json.total : null,
	};
}

export function aggregateOwnedCards(rows: CollectionRow[]): OwnedCard[] {
	const byCard = new Map<string, OwnedCard>();
	for (const row of rows) {
		const existing = byCard.get(row.card.cardId);
		byCard.set(row.card.cardId, {
			...row.card,
			copies: (existing?.copies ?? 0) + 1,
			starredCopies: (existing?.starredCopies ?? 0) + (row.starred ? 1 : 0),
		});
	}
	return [...byCard.values()];
}

export function collectionPageUrl(page: number): string {
	return `/api/my-collection?sort=rarity&page=${page}&stats=${page === 0 ? 1 : 0}`;
}

export function createCollectionIndexer(
	queue: RequestQueue,
	saveCards: (cards: TitledCardRef[]) => Promise<void>,
): CollectionIndexer {
	let runningSync: Promise<unknown> | null = null;
	let firstPageReady: Promise<unknown> | null = null;

	async function loadPage(page: number, priority: RequestPriority): Promise<CollectionPage> {
		const collectionPage = parseCollectionPage(await queue.getJson(collectionPageUrl(page), priority));
		await saveCards(collectionPage.rows.map((row) => row.card));
		return collectionPage;
	}

	async function sync(): Promise<void> {
		const loadingFirstPage = loadPage(0, "visible");
		firstPageReady = loadingFirstPage;
		const firstPage = await loadingFirstPage;
		const pageCount = Math.ceil((firstPage.total ?? 0) / COLLECTION_PAGE_SIZE);
		const remainingPages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 1);
		const otherPages = await Promise.all(remainingPages.map((page) => loadPage(page, "background")));
		await ownedCardsItem.setValue(aggregateOwnedCards([firstPage, ...otherPages].flatMap((page) => page.rows)));
		await lastSyncedAt.setValue(Date.now());
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
					const isRecent = Date.now() - (await lastSyncedAt.getValue()) < SYNC_INTERVAL_MS;
					if (isRecent && (await ownedCardsItem.getValue()).length > 0) return;
					await sync();
				})(),
			);
		},
		async whenIdle() {
			await firstPageReady?.catch(() => undefined);
		},
	};
}
