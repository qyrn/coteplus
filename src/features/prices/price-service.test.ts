import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { RequestQueue } from "../../lib/net/request-queue";
import { createPriceService } from "./price-service";

const collectionResponse = {
	total: 3,
	collection: [
		{ card: { id: "common", wikipedia_title: "Chat", rarity: "C" } },
		{ card: { id: "legend", wikipedia_title: "Soleil", rarity: "L" } },
		{ card: { id: "common", wikipedia_title: "Chat", rarity: "C" } },
	],
};

function fakeQueue(requestedUrls: string[]): RequestQueue {
	return {
		async getJson(url) {
			requestedUrls.push(url);
			if (url.startsWith("/api/my-collection")) return collectionResponse;
			return { summary: { L: { average: 500 }, C: { average: 2 } } };
		},
	};
}

describe("loadAllOwnedPrices", () => {
	beforeEach(() => fakeBrowser.reset());

	it("loads each owned card once, highest rarity first", async () => {
		const requestedUrls: string[] = [];
		const service = createPriceService(fakeQueue(requestedUrls));
		const progress = await service.loadAllOwnedPrices({ signal: new AbortController().signal, onProgress: () => {} });
		expect(progress).toEqual({ done: 2, total: 2, failed: 0 });
		expect(requestedUrls.filter((url) => url.includes("/sales"))).toEqual([
			"/api/marketplace/cards/legend/sales?scope=summary",
			"/api/marketplace/cards/common/sales?scope=summary",
		]);
	});

	it("skips prices fetched less than a day ago", async () => {
		const requestedUrls: string[] = [];
		const service = createPriceService(fakeQueue(requestedUrls));
		const options = { signal: new AbortController().signal, onProgress: () => {} };
		await service.loadAllOwnedPrices(options);
		requestedUrls.length = 0;
		await service.loadAllOwnedPrices(options);
		expect(requestedUrls.some((url) => url.includes("/sales"))).toBe(false);
	});

	it("stops when aborted", async () => {
		const requestedUrls: string[] = [];
		const controller = new AbortController();
		controller.abort();
		const service = createPriceService(fakeQueue(requestedUrls));
		const progress = await service.loadAllOwnedPrices({ signal: controller.signal, onProgress: () => {} });
		expect(progress.done).toBe(0);
		expect(requestedUrls.some((url) => url.includes("/sales"))).toBe(false);
	});
});
