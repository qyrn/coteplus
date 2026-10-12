import { describe, expect, it, vi } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { loadMissingPrices, pricingOrder } from "./collection-pricing";

function owned(cardId: string, rarity: OwnedCard["rarity"], copies = 1): OwnedCard {
	return { cardId, hideImage: false, title: cardId, rarity, copies, starredCopies: 0 };
}

describe("pricingOrder", () => {
	it("skips priced cards and starts with the rarest, then the most copies", () => {
		const order = pricingOrder(
			[owned("c", "C", 1), owned("l", "L"), owned("r1", "R", 1), owned("r2", "R", 3), owned("sr", "SR")],
			new Set(["sr"]),
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
		const priceService: PriceService = {
			getPrice: async () => ({ value: null, stats: null, refreshed: null }),
			cachedPriceStats: async () => new Map(),
			loadIfUnknown,
		};
		const onLoaded = vi.fn();
		const completed = await loadMissingPrices([owned("a", "L"), owned("b", "C")], priceService, () => wanted, onLoaded);
		expect(completed).toBe(false);
		expect(loadIfUnknown).toHaveBeenCalledTimes(1);
		expect(onLoaded).toHaveBeenCalledTimes(1);
	});
});
