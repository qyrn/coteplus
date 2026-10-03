import { describe, expect, it } from "vitest";
import type { FollowedAuction } from "./followed-auctions";
import { standingCheckPeriod } from "./standing-watch";

const MINUTE = 60 * 1000;
const now = 1000 * MINUTE;

function followed(overrides: Partial<FollowedAuction>): FollowedAuction {
	return {
		id: "a",
		title: "Cristaline",
		rarity: "SR",
		endAt: now + 60 * MINUTE,
		source: "bid",
		remindedAt: null,
		standing: "leading",
		currentBid: 165,
		...overrides,
	};
}

describe("standingCheckPeriod", () => {
	it("checks every two minutes while bids are running", () => {
		expect(standingCheckPeriod([followed({})], now)).toBe(2 * MINUTE);
	});

	it("checks every thirty seconds near the end", () => {
		expect(standingCheckPeriod([followed({ endAt: now + 5 * MINUTE })], now)).toBe(30 * 1000);
	});

	it("keeps checking an ended bid until it is settled", () => {
		expect(standingCheckPeriod([followed({ endAt: now - MINUTE })], now)).toBe(30 * 1000);
		expect(standingCheckPeriod([followed({ endAt: now - 2 * 60 * MINUTE })], now)).toBeNull();
	});

	it("stays idle without any bid", () => {
		expect(standingCheckPeriod([followed({ source: "manual", standing: null })], now)).toBeNull();
		expect(standingCheckPeriod([followed({ standing: "won", endAt: now - MINUTE })], now)).toBeNull();
	});
});
