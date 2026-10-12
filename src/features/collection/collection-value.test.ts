import { describe, expect, it } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import { computeCollectionValue, dayKey, raritiesByValue, recordValuePoint } from "./collection-value";
import { sparklinePoints } from "./value-sparkline";

function owned(cardId: string, rarity: OwnedCard["rarity"], copies: number): OwnedCard {
	return { cardId, hideImage: false, title: cardId, rarity, copies, starredCopies: 0 };
}

function statsFrom(cotes: ReadonlyMap<string, number>) {
	return (card: OwnedCard) => {
		const cote = cotes.get(card.cardId);
		return cote === undefined
			? null
			: { value: cote, basis: "recent" as const, low: null, high: null, salesCount: null, latestPrice: null };
	};
}

describe("computeCollectionValue", () => {
	it("adds every copy at its cote", () => {
		const value = computeCollectionValue(
			[owned("a", "L", 2), owned("b", "R", 1)],
			statsFrom(
				new Map([
					["a", 100],
					["b", 40],
				]),
			),
			new Set(),
		);
		expect(value).toEqual({
			total: 240,
			byRarity: { L: 200, R: 40 },
			pricedCards: 2,
			estimatedCards: 0,
			ownedCards: 2,
		});
		expect(raritiesByValue(value)).toEqual([
			["L", 200],
			["R", 40],
		]);
	});

	it("prices the other cards of an estimated rarity at the average of its sample", () => {
		const cotes = new Map([
			["c1", 10],
			["c2", 30],
			["c3", 500],
		]);
		const value = computeCollectionValue(
			[owned("c1", "C", 1), owned("c2", "C", 1), owned("c3", "C", 1), owned("c4", "C", 2), owned("u1", "UR", 1)],
			statsFrom(cotes),
			new Set(["c1", "c2"]),
		);
		expect(value).toMatchObject({ total: 580, byRarity: { C: 580 }, pricedCards: 3, estimatedCards: 1 });
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
