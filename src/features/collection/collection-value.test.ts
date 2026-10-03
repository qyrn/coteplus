import { describe, expect, it } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import { computeCollectionValue, dayKey, raritiesByValue, recordValuePoint } from "./collection-value";
import { sparklinePoints } from "./value-sparkline";

function owned(cardId: string, rarity: OwnedCard["rarity"], copies: number): OwnedCard {
	return { cardId, hideImage: false, title: cardId, rarity, copies, starredCopies: 0 };
}

describe("computeCollectionValue", () => {
	it("adds every copy at its average price and skips unknown prices", () => {
		const averages = new Map([
			["a", 100],
			["b", 40],
		]);
		const value = computeCollectionValue([owned("a", "L", 2), owned("b", "R", 1), owned("c", "C", 5)], (card) => {
			const average = averages.get(card.cardId);
			return average === undefined ? null : { average, salesCount: null, latestPrice: null };
		});
		expect(value).toEqual({ total: 240, byRarity: { L: 200, R: 40 }, pricedCards: 2, ownedCards: 3 });
		expect(raritiesByValue(value)).toEqual([
			["L", 200],
			["R", 40],
		]);
	});
});

describe("recordValuePoint", () => {
	it("keeps one point per day in order", () => {
		const point = (day: string, total: number) => ({ day, total, pricedCards: 1, ownedCards: 1 });
		const history = recordValuePoint([point("2026-10-02", 10), point("2026-10-03", 20)], point("2026-10-03", 25));
		expect(history.map((entry) => entry.total)).toEqual([10, 25]);
	});

	it("formats the local day", () => {
		expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
	});
});

describe("sparklinePoints", () => {
	it("maps the lowest value to the bottom and the highest to the top", () => {
		expect(sparklinePoints([0, 10], 100, 50, 0)).toBe("0.0,50.0 100.0,0.0");
		expect(sparklinePoints([5], 100, 50, 0)).toBe("");
	});
});
