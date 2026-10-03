import { describe, expect, it } from "vitest";
import type { FollowedAuction } from "../../features/market/followed-auctions";
import { standingText } from "./auction-section";

function followed(overrides: Partial<FollowedAuction>): FollowedAuction {
	return {
		id: "a",
		title: "Cristaline",
		rarity: "SR",
		endAt: 0,
		source: "bid",
		remindedAt: null,
		standing: null,
		currentBid: null,
		...overrides,
	};
}

describe("standingText", () => {
	it("shows the standing with the current bid", () => {
		expect(standingText(followed({ standing: "leading", currentBid: 165 }))).toBe("En tête · 165 W");
		expect(standingText(followed({ standing: "outbid", currentBid: 180 }))).toBe("Dépassé · 180 W");
	});

	it("hides the amount of a lost auction", () => {
		expect(standingText(followed({ standing: "lost", currentBid: 180 }))).toBe("Perdue");
	});

	it("stays empty without a known standing", () => {
		expect(standingText(followed({}))).toBeNull();
	});
});
