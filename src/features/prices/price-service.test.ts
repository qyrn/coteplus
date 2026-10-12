import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { HttpError, type RequestQueue } from "../../lib/net/request-queue";
import type { CardCatalog } from "../cards/card-catalog";
import { createPriceService } from "./price-service";

const catalog: CardCatalog = {
	collectionIndexer: { syncIfStale: async () => undefined, whenIdle: async () => undefined },
	resolve: async (title) => ({ cardId: `id-${title}`, hideImage: false }),
	learnFrom: () => undefined,
};

function proRefusingQueue() {
	return {
		getJson: vi.fn<RequestQueue["getJson"]>(async (url) => {
			if (!url.endsWith("?scope=summary")) throw new HttpError(403, url);
			return { summary: { C: { average: 12 } } };
		}),
	};
}

describe("createPriceService", () => {
	beforeEach(() => fakeBrowser.reset());

	it("falls back to the summary when the full sales history is reserved to Pro", async () => {
		const queue = proRefusingQueue();
		const prices = createPriceService(queue, catalog);
		expect((await prices.getPrice("Paris", "C")).value).toBe(12);
	});

	it("stops asking for the full history once the site refused it", async () => {
		const queue = proRefusingQueue();
		const prices = createPriceService(queue, catalog);
		await prices.getPrice("Paris", "C");
		await prices.getPrice("Lyon", "C");
		const fullHistoryCalls = queue.getJson.mock.calls.filter(([url]) => !String(url).endsWith("?scope=summary"));
		expect(fullHistoryCalls).toHaveLength(1);
	});
});
