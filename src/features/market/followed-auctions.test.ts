import { describe, expect, it } from "vitest";
import {
	dropLongEnded,
	dueReminders,
	type FollowedAuction,
	followAuction,
	followBids,
	nextReminderAt,
	unfollowAuction,
	updateStandings,
} from "./followed-auctions";
import type { AuctionSummary } from "./my-market";

const MINUTE = 60 * 1000;

function auction(id: string, endAt: number, status: AuctionSummary["status"] = "active"): AuctionSummary {
	return {
		id,
		cardId: null,
		title: `Carte ${id}`,
		rarity: "R",
		endAt,
		status,
		finalPrice: null,
		currentBid: 10,
		baseAmount: 1,
		winnerId: null,
		currentBidderId: null,
		sellerId: null,
	};
}

function followed(id: string, endAt: number, remindedAt: number | null = null): FollowedAuction {
	return {
		id,
		title: `Carte ${id}`,
		rarity: "R",
		endAt,
		source: "manual",
		remindedAt,
		standing: null,
		currentBid: null,
	};
}

describe("followAuction", () => {
	it("keeps the reminder state when the end time is unchanged", () => {
		const start = { a: followed("a", 100 * MINUTE, 95 * MINUTE) };
		expect(followAuction(start, auction("a", 100 * MINUTE), "bid").a).toMatchObject({
			remindedAt: 95 * MINUTE,
			source: "manual",
		});
	});

	it("resets the reminder when the auction is extended", () => {
		const start = { a: followed("a", 100 * MINUTE, 95 * MINUTE) };
		expect(followAuction(start, auction("a", 101 * MINUTE), "bid").a?.remindedAt).toBeNull();
	});
});

describe("followBids", () => {
	it("follows active bids except excluded ones", () => {
		const bids = [auction("a", 10), auction("b", 10), auction("c", 10, "settled_sold")];
		expect(Object.keys(followBids({}, bids, ["b"]))).toEqual(["a"]);
	});
});

describe("unfollowAuction", () => {
	it("removes one auction", () => {
		expect(unfollowAuction({ a: followed("a", 1), b: followed("b", 1) }, "a")).toEqual({ b: followed("b", 1) });
	});
});

describe("reminders", () => {
	const now = 1000 * MINUTE;
	const LEAD = 5 * MINUTE;

	it("finds reminders due before the end", () => {
		const list = [
			followed("due", now + 3 * MINUTE),
			followed("later", now + 30 * MINUTE),
			followed("ended", now - MINUTE),
			followed("done", now + 2 * MINUTE, now - MINUTE),
		];
		expect(dueReminders(list, now, LEAD).map((item) => item.id)).toEqual(["due"]);
	});

	it("computes the next reminder time", () => {
		const list = [followed("a", now + 30 * MINUTE), followed("b", now + 20 * MINUTE)];
		expect(nextReminderAt(list, now, LEAD)).toBe(now + 20 * MINUTE - LEAD);
		expect(nextReminderAt([], now, LEAD)).toBeNull();
	});

	it("drops auctions ended more than a day ago", () => {
		const list = { old: followed("old", now - 25 * 60 * MINUTE), recent: followed("recent", now - MINUTE) };
		expect(Object.keys(dropLongEnded(list, now))).toEqual(["recent"]);
	});
});

describe("updateStandings", () => {
	const now = 1000 * MINUTE;
	const market = (bidding: AuctionSummary[], won: AuctionSummary[] = []) => ({
		viewerId: "me",
		bidding,
		won,
		history: [],
	});

	it("tells whether the player leads a live auction", () => {
		const list = { a: followed("a", now + MINUTE), b: followed("b", now + MINUTE) };
		const bids = [
			{ ...auction("a", now + MINUTE), currentBidderId: "me", currentBid: 120 },
			{ ...auction("b", now + MINUTE), currentBidderId: "rival", currentBid: 80 },
		];
		const result = updateStandings(list, market(bids), now);
		expect(result.a).toMatchObject({ standing: "leading", currentBid: 120 });
		expect(result.b).toMatchObject({ standing: "outbid", currentBid: 80 });
	});

	it("settles ended auctions as won or lost", () => {
		const list = {
			won: { ...followed("won", now - MINUTE), standing: "leading" as const },
			lost: { ...followed("lost", now - MINUTE), standing: "outbid" as const },
			watched: followed("watched", now - MINUTE),
		};
		const result = updateStandings(list, market([], [auction("won", now - MINUTE)]), now);
		expect(result.won?.standing).toBe("won");
		expect(result.lost?.standing).toBe("lost");
		expect(result.watched?.standing).toBeNull();
	});

	it("changes nothing without the player id", () => {
		const list = { a: followed("a", now + MINUTE) };
		expect(updateStandings(list, { ...market([auction("a", now + MINUTE)]), viewerId: null }, now)).toBe(list);
	});
});
