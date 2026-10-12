import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { RequestQueue } from "../../lib/net/request-queue";
import {
	aggregateOwnedCards,
	collectionPageUrl,
	createCollectionIndexer,
	parseCollectionPage,
} from "./collection-index";

describe("parseCollectionPage", () => {
	it("extracts owned card rows and the total", () => {
		const json = {
			total: 1236,
			collection: [
				{
					id: "copy-1",
					starred: true,
					card: { id: "a", wikipedia_title: "Benjamin  Castaldi", rarity: "L" },
				},
				{ id: "copy-2", card: { id: "b", wikipedia_title: "Inconnu", rarity: "ZZ" } },
				{ id: "copy-3" },
			],
		};
		expect(parseCollectionPage(json)).toEqual({
			rows: [{ card: { cardId: "a", hideImage: false, title: "Benjamin Castaldi", rarity: "L" }, starred: true }],
			total: 1236,
		});
	});

	it("tolerates unexpected payloads", () => {
		expect(parseCollectionPage("oops")).toEqual({ rows: [], total: null });
	});
});

describe("aggregateOwnedCards", () => {
	it("counts copies and starred copies per card", () => {
		const card = { cardId: "a", hideImage: false, title: "Chat", rarity: "C" as const };
		expect(
			aggregateOwnedCards([
				{ card, starred: false },
				{ card, starred: true },
				{ card: { ...card, cardId: "b", title: "Hibou" }, starred: false },
			]),
		).toEqual([
			{ ...card, copies: 2, starredCopies: 1 },
			{ ...card, cardId: "b", title: "Hibou", copies: 1, starredCopies: 0 },
		]);
	});
});

describe("collectionPageUrl", () => {
	it("asks for stats only on the first page", () => {
		expect(collectionPageUrl(0)).toBe("/api/my-collection?sort=rarity&page=0&stats=1");
		expect(collectionPageUrl(3)).toBe("/api/my-collection?sort=rarity&page=3&stats=0");
	});
});

describe("createCollectionIndexer", () => {
	beforeEach(() => fakeBrowser.reset());

	it("reads a total sent as text", () => {
		expect(parseCollectionPage({ total: "120", collection: [] }).total).toBe(120);
	});

	it("waits before retrying a failed sync", async () => {
		const queue = { getJson: vi.fn<RequestQueue["getJson"]>(async () => Promise.reject(new Error("down"))) };
		const indexer = createCollectionIndexer(queue, async () => undefined);
		await expect(indexer.syncIfStale()).rejects.toThrow("down");
		await indexer.syncIfStale();
		expect(queue.getJson).toHaveBeenCalledTimes(1);
	});

	it("does not sync again a collection synced recently, even when empty", async () => {
		const queue = { getJson: vi.fn<RequestQueue["getJson"]>(async () => ({ total: 0, collection: [] })) };
		const indexer = createCollectionIndexer(queue, async () => undefined);
		await indexer.syncIfStale();
		await indexer.syncIfStale();
		expect(queue.getJson).toHaveBeenCalledTimes(1);
	});
});
