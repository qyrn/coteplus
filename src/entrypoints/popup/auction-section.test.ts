import { describe, expect, it } from "vitest";
import type { FollowedAuction } from "../../features/market/followed-auctions";
import { isShownInPopup, standingText } from "./auction-section";

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

	it("stays empty without a known standing", () => {
		expect(standingText(followed({}))).toBeNull();
	});
});

describe("isShownInPopup", () => {
	const now = 1_000;

	it("keeps running auctions whatever their standing", () => {
		expect(isShownInPopup(followed({ endAt: now + 1, standing: "outbid" }), now)).toBe(true);
		expect(isShownInPopup(followed({ endAt: now + 1 }), now)).toBe(true);
	});

	it("keeps ended auctions that were won or still lead", () => {
		expect(isShownInPopup(followed({ endAt: now, standing: "won" }), now)).toBe(true);
		expect(isShownInPopup(followed({ endAt: now, standing: "leading" }), now)).toBe(true);
	});

	it("hides ended auctions that were not won", () => {
		expect(isShownInPopup(followed({ endAt: now, standing: "lost" }), now)).toBe(false);
		expect(isShownInPopup(followed({ endAt: now, standing: "outbid" }), now)).toBe(false);
		expect(isShownInPopup(followed({ endAt: now }), now)).toBe(false);
	});
});
