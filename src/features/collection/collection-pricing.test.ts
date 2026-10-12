import { describe, expect, it, vi } from "vitest";
import { SiteApiPausedError } from "../../lib/net/site-api-guard";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { loadMissingPrices, pricingOrder } from "./collection-pricing";

function owned(cardId: string, rarity: OwnedCard["rarity"], copies = 1): OwnedCard {
	return { cardId, hideImage: false, title: cardId, rarity, copies, starredCopies: 0 };
}

function fakePriceService(loadIfUnknown: PriceService["loadIfUnknown"]): PriceService {
	return {
		getPrice: async () => ({ value: null, stats: null, refreshed: null }),
		cachedPriceStats: async () => new Map(),
		checkedCardIds: async () => new Set(),
		loadIfUnknown,
	};
}

describe("pricingOrder", () => {
	it("keeps unchecked L, UR and sampled cards, rarest first then most copies", () => {
		const order = pricingOrder(
			[owned("c", "C"), owned("l", "L"), owned("r1", "R", 1), owned("r2", "R", 3), owned("u", "UR"), owned("c2", "C")],
			new Set(["u"]),
			new Set(["c", "r1", "r2"]),
		);
		expect(order.map((card) => card.cardId)).toEqual(["l", "r2", "r1", "c"]);
	});
});

describe("loadMissingPrices", () => {
	it("stops as soon as the prices are no longer wanted", async () => {
		let wanted = true;
		const loadIfUnknown = vi.fn<PriceService["loadIfUnknown"]>(async () => {
			wanted = false;
			return true;
		});
		const onLoaded = vi.fn();
		const completed = await loadMissingPrices(
			[owned("a", "L"), owned("b", "C")],
			fakePriceService(loadIfUnknown),
			() => wanted,
			onLoaded,
		);
		expect(completed).toBe(false);
		expect(loadIfUnknown).toHaveBeenCalledTimes(1);
		expect(onLoaded).toHaveBeenCalledTimes(1);
	});

	it("reports an unfinished run when the site pauses the extension", async () => {
		const loadIfUnknown = vi.fn<PriceService["loadIfUnknown"]>(async () => {
			throw new SiteApiPausedError("Requêtes en pause");
		});
		const cards = Array.from({ length: 10 }, (_, index) => owned(`c${index}`, "C"));
		await expect(loadMissingPrices(cards, fakePriceService(loadIfUnknown), () => true, vi.fn())).resolves.toBe(false);
		expect(loadIfUnknown.mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("keeps going after a card that fails on its own", async () => {
		const loadIfUnknown = vi.fn<PriceService["loadIfUnknown"]>(async (card) => {
			if (card.cardId === "c0") throw new Error("HTTP 500");
			return true;
		});
		const cards = Array.from({ length: 4 }, (_, index) => owned(`c${index}`, "C"));
		await expect(loadMissingPrices(cards, fakePriceService(loadIfUnknown), () => true, vi.fn())).resolves.toBe(true);
		expect(loadIfUnknown).toHaveBeenCalledTimes(4);
	});
});
