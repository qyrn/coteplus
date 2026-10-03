import { describe, expect, it } from "vitest";
import type { FollowedAuction } from "./followed-auctions";
import { standingChanges } from "./standing-changes";

function followed(standing: FollowedAuction["standing"]): FollowedAuction {
	return {
		id: "a",
		title: "Cristaline",
		rarity: "SR",
		endAt: 0,
		source: "bid",
		remindedAt: null,
		standing,
		currentBid: 180,
	};
}

describe("standingChanges", () => {
	it("reports when the player loses the lead", () => {
		expect(standingChanges({ a: followed("leading") }, { a: followed("outbid") })).toEqual([
			{ kind: "outbid", auction: followed("outbid") },
		]);
	});

	it("reports a win once", () => {
		expect(standingChanges({ a: followed("leading") }, { a: followed("won") })).toHaveLength(1);
		expect(standingChanges({ a: followed("won") }, { a: followed("won") })).toEqual([]);
	});

	it("ignores auctions seen for the first time", () => {
		expect(standingChanges({}, { a: followed("outbid") })).toEqual([]);
	});
});
