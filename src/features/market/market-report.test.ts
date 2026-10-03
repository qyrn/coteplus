import { describe, expect, it } from "vitest";
import { buildMarketReport, compareWithAverages, differenceFromAverage } from "./market-report";
import type { AuctionSummary } from "./my-market";

function auction(overrides: Partial<AuctionSummary>): AuctionSummary {
	return {
		id: "00000000-0000-0000-0000-000000000000",
		cardId: null,
		title: "Carte",
		rarity: "R",
		endAt: 0,
		status: "settled_sold",
		finalPrice: 100,
		currentBid: 100,
		baseAmount: 10,
		winnerId: "someone",
		...overrides,
	};
}

describe("buildMarketReport", () => {
	it("separates sales from purchases found in the history", () => {
		const report = buildMarketReport({
			bidding: [],
			won: [auction({ winnerId: "me", finalPrice: 40 }), auction({ winnerId: "me", finalPrice: 60 })],
			history: [
				auction({ winnerId: "buyer", finalPrice: 300 }),
				auction({ winnerId: "me", finalPrice: 40 }),
				auction({ status: "settled_unsold", winnerId: null, finalPrice: null, currentBid: null }),
			],
		});
		expect(report).toMatchObject({
			soldCount: 1,
			unsoldCount: 1,
			earned: 300,
			boughtCount: 2,
			spent: 100,
			net: 200,
		});
	});
});

describe("average comparison", () => {
	it("compares prices with known averages only", () => {
		const comparison = compareWithAverages(
			[auction({ finalPrice: 150 }), auction({ finalPrice: 50 }), auction({ finalPrice: 999 })],
			[100, 100, null],
		);
		expect(comparison).toEqual({ paidOrEarned: 200, averageTotal: 200, comparedCount: 2 });
		expect(differenceFromAverage(comparison)).toBe(0);
	});

	it("returns null without comparable sales", () => {
		expect(differenceFromAverage({ paidOrEarned: 0, averageTotal: 0, comparedCount: 0 })).toBeNull();
	});
});
