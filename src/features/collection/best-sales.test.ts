import { describe, expect, it } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import { rankBestSales } from "./best-sales";

function owned(cardId: string, copies: number, starredCopies = 0): OwnedCard {
	return { cardId, title: cardId, rarity: "R", hideImage: false, copies, starredCopies };
}

const averages: Record<string, number | null> = { cheap: 5, rich: 900, double: 300, starred: 2000, unknown: null };
const averageOf = (card: OwnedCard) => averages[card.cardId] ?? null;
const collection = [
	owned("cheap", 1),
	owned("rich", 1),
	owned("double", 3),
	owned("starred", 1, 1),
	owned("unknown", 4),
];

describe("rankBestSales", () => {
	it("ranks sellable cards by average price", () => {
		const view = rankBestSales(collection, averageOf, { duplicatesOnly: false, limit: 10 });
		expect(view.entries.map((sale) => sale.card.cardId)).toEqual(["rich", "double", "cheap"]);
		expect(view.pricedCards).toBe(4);
		expect(view.ownedCards).toBe(5);
	});

	it("keeps only duplicates on request", () => {
		const view = rankBestSales(collection, averageOf, { duplicatesOnly: true, limit: 10 });
		expect(view.entries.map((sale) => [sale.card.cardId, sale.sellableCopies])).toEqual([["double", 3]]);
	});

	it("applies the limit", () => {
		expect(rankBestSales(collection, averageOf, { duplicatesOnly: false, limit: 1 }).entries).toHaveLength(1);
	});
});
