import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { isRarity, type Rarity } from "../../lib/site/rarity";
import type { AuctionSummary, MyMarket } from "./my-market";

export type FollowSource = "manual" | "bid";

export type AuctionStanding = "leading" | "outbid" | "won" | "lost";

export interface FollowedAuction {
	id: string;
	title: string;
	rarity: Rarity;
	endAt: number;
	source: FollowSource;
	remindedAt: number | null;
	standing: AuctionStanding | null;
	currentBid: number | null;
}

export type FollowedAuctions = Record<string, FollowedAuction>;

const ENDED_RETENTION_MS = 24 * 60 * 60 * 1000;

export const followedAuctionsItem = storage.defineItem<FollowedAuctions>("local:followed-auctions", { fallback: {} });
export const unfollowedBidsItem = storage.defineItem<string[]>("local:unfollowed-bid-auctions", { fallback: [] });

const STANDINGS: readonly string[] = ["leading", "outbid", "won", "lost"];

function isStanding(value: unknown): value is AuctionStanding {
	return typeof value === "string" && STANDINGS.includes(value);
}

function readFollowedAuction(value: unknown): FollowedAuction | null {
	if (!isRecord(value)) return null;
	const { id, title, rarity, endAt, source, remindedAt, standing, currentBid } = value;
	if (typeof id !== "string" || typeof title !== "string" || typeof rarity !== "string" || !isRarity(rarity)) {
		return null;
	}
	if (typeof endAt !== "number" || (source !== "manual" && source !== "bid")) return null;
	return {
		id,
		title,
		rarity,
		endAt,
		source,
		remindedAt: typeof remindedAt === "number" ? remindedAt : null,
		standing: isStanding(standing) ? standing : null,
		currentBid: typeof currentBid === "number" ? currentBid : null,
	};
}

export function readFollowedAuctions(value: unknown): FollowedAuction[] {
	return isRecord(value)
		? Object.values(value)
				.map(readFollowedAuction)
				.filter((auction): auction is FollowedAuction => auction !== null)
		: [];
}

export function followAuction(
	followed: FollowedAuctions,
	auction: AuctionSummary,
	source: FollowSource,
): FollowedAuctions {
	const existing = followed[auction.id];
	const remindedAt = existing && existing.endAt === auction.endAt ? existing.remindedAt : null;
	return {
		...followed,
		[auction.id]: {
			id: auction.id,
			title: auction.title,
			rarity: auction.rarity,
			endAt: auction.endAt,
			source: existing?.source ?? source,
			remindedAt,
			standing: existing?.standing ?? null,
			currentBid: auction.currentBid ?? existing?.currentBid ?? null,
		},
	};
}

export function unfollowAuction(followed: FollowedAuctions, auctionId: string): FollowedAuctions {
	const { [auctionId]: _removed, ...remaining } = followed;
	return remaining;
}

export async function stopFollowing(auctionId: string): Promise<void> {
	const current = await followedAuctionsItem.getValue();
	if (current[auctionId]?.source === "bid") {
		const excluded = await unfollowedBidsItem.getValue();
		await unfollowedBidsItem.setValue([...new Set([...excluded, auctionId])]);
	}
	await followedAuctionsItem.setValue(unfollowAuction(current, auctionId));
}

export function followBids(
	followed: FollowedAuctions,
	bids: AuctionSummary[],
	excludedIds: string[],
): FollowedAuctions {
	const excluded = new Set(excludedIds);
	return bids
		.filter((bid) => bid.status === "active" && !excluded.has(bid.id))
		.reduce((current, bid) => followAuction(current, bid, "bid"), followed);
}

export function updateStandings(followed: FollowedAuctions, market: MyMarket, now: number): FollowedAuctions {
	const { viewerId } = market;
	if (!viewerId) return followed;
	const bidding = new Map(market.bidding.map((auction) => [auction.id, auction]));
	const wonIds = new Set(market.won.map((auction) => auction.id));
	return Object.fromEntries(
		readFollowedAuctions(followed).map((auction): [string, FollowedAuction] => {
			const live = bidding.get(auction.id);
			if (live) {
				const standing = live.currentBidderId === viewerId ? "leading" : "outbid";
				return [auction.id, { ...auction, standing, currentBid: live.currentBid ?? auction.currentBid }];
			}
			if (wonIds.has(auction.id)) return [auction.id, { ...auction, standing: "won" }];
			const hadBid = auction.standing === "leading" || auction.standing === "outbid";
			if (hadBid && auction.endAt <= now) return [auction.id, { ...auction, standing: "lost" }];
			return [auction.id, auction];
		}),
	);
}

export function syncFollowedWithMarket(
	followed: FollowedAuctions,
	market: MyMarket,
	excludedIds: string[],
	now: number,
): FollowedAuctions {
	return updateStandings(followBids(followed, market.bidding, excludedIds), market, now);
}

export function dropLongEnded(followed: FollowedAuctions, now: number): FollowedAuctions {
	return Object.fromEntries(
		readFollowedAuctions(followed)
			.filter((auction) => now - auction.endAt < ENDED_RETENTION_MS)
			.map((auction) => [auction.id, auction]),
	);
}

function reminderAt(auction: FollowedAuction, leadMs: number): number {
	return auction.endAt - leadMs;
}

export function dueReminders(auctions: FollowedAuction[], now: number, leadMs: number): FollowedAuction[] {
	return auctions.filter(
		(auction) => auction.remindedAt === null && reminderAt(auction, leadMs) <= now && auction.endAt > now,
	);
}

export function nextReminderAt(auctions: FollowedAuction[], now: number, leadMs: number): number | null {
	const upcoming = auctions
		.filter((auction) => auction.remindedAt === null && auction.endAt > now)
		.map((auction) => Math.max(reminderAt(auction, leadMs), now));
	return upcoming.length > 0 ? Math.min(...upcoming) : null;
}
