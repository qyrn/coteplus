import { describe, expect, it } from "vitest";
import { parseAuctionDetail, parseMyMarket } from "./my-market";

const auctionJson = {
	id: "4644542d-783f-4c3d-888a-1ac0e5c5b0a1",
	snapshot_rarity: "SR",
	end_at: "2026-09-30T23:00:59.838403+00:00",
	status: "settled_sold",
	final_price: 330,
	current_bid: 330,
	base_amount: 10,
	winner_id: "buyer",
	card: { wikipedia_title: "KGB", rarity: "R" },
};

describe("parseMyMarket", () => {
	it("reads the player's auction lists", () => {
		const market = parseMyMarket({ bidding: [], won: [auctionJson], history: [auctionJson, { id: "bad" }] });
		expect(market.won).toEqual([
			{
				id: auctionJson.id,
				title: "KGB",
				rarity: "SR",
				endAt: Date.parse(auctionJson.end_at),
				status: "settled_sold",
				finalPrice: 330,
				currentBid: 330,
				baseAmount: 10,
				winnerId: "buyer",
			},
		]);
		expect(market.history).toHaveLength(1);
	});
});

describe("parseAuctionDetail", () => {
	it("reads the auction from the detail response", () => {
		expect(parseAuctionDetail({ auction: auctionJson, bids: [] })?.title).toBe("KGB");
		expect(parseAuctionDetail({})).toBeNull();
	});
});
