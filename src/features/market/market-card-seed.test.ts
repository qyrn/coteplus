import { describe, expect, it } from "vitest";
import { parseAuctionCards } from "./market-card-seed";

describe("parseAuctionCards", () => {
	it("maps each auction card under its snapshot and current rarity", () => {
		const json = {
			auctions: [
				{
					card_id: "c1",
					snapshot_rarity: "SR",
					card: { id: "c1", wikipedia_title: "DJ  Fou", rarity: "UR", hide_image: true },
				},
				{ card_id: "c2", snapshot_rarity: "R", card: { wikipedia_title: "Chat", rarity: "R" } },
				{ snapshot_rarity: "R", card: { rarity: "R" } },
			],
		};
		expect(parseAuctionCards(json)).toEqual([
			{ cardId: "c1", title: "DJ Fou", rarity: "SR", hideImage: true },
			{ cardId: "c1", title: "DJ Fou", rarity: "UR", hideImage: true },
			{ cardId: "c2", title: "Chat", rarity: "R", hideImage: false },
		]);
	});
});
