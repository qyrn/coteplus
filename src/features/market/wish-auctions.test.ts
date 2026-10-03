import { describe, expect, it } from "vitest";
import type { AuctionSummary } from "./my-market";
import { parseActiveAuctionsFor, priceToPay, rankAuctions, wishSearchUrl } from "./wish-auctions";

function auctionJson(id: string, title: string, overrides: Record<string, unknown> = {}) {
	return {
		id: `${id}0000000-0000-0000-0000-000000000000`.slice(0, 36),
		snapshot_rarity: "R",
		end_at: "2030-01-01T00:00:00Z",
		status: "active",
		current_bid: null,
		base_amount: 10,
		card: { wikipedia_title: title },
		...overrides,
	};
}

function summary(currentBid: number | null, baseAmount: number): AuctionSummary {
	return {
		id: "x",
		cardId: null,
		title: "Chat",
		rarity: "R",
		endAt: 0,
		status: "active",
		finalPrice: null,
		currentBid,
		baseAmount,
		winnerId: null,
	};
}

describe("wishSearchUrl", () => {
	it("searches recent auctions by title", () => {
		expect(wishSearchUrl("Chat noir")).toBe("/api/marketplace?page=1&limit=50&sort=recent&q=Chat+noir");
	});
});

describe("parseActiveAuctionsFor", () => {
	it("keeps active auctions of the exact card", () => {
		const json = {
			auctions: [
				auctionJson("a", "Chat"),
				auctionJson("b", "Chat noir"),
				auctionJson("c", "Chat", { status: "cancelled" }),
				auctionJson("d", "Chat", { end_at: "2000-01-01T00:00:00Z" }),
			],
		};
		expect(parseActiveAuctionsFor(json, "Chat", Date.parse("2026-10-03")).map((auction) => auction.id[0])).toEqual([
			"a",
		]);
	});
});

describe("priceToPay", () => {
	it("uses the current bid, then the starting price", () => {
		expect(priceToPay(summary(40, 10))).toBe(40);
		expect(priceToPay(summary(null, 10))).toBe(10);
	});
});

describe("rankAuctions", () => {
	it("puts the best deal first and unknown averages last", () => {
		const ranked = rankAuctions([summary(90, 1), summary(30, 1), summary(10, 1)], [100, 100, null], 20);
		expect(ranked.map((entry) => entry.price)).toEqual([30, 90, 10]);
		expect(ranked[0]?.deal?.level).toBe("great");
	});
});
