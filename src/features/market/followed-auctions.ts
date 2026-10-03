import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { isRarity, type Rarity } from "../../lib/site/rarity";
import type { AuctionSummary } from "./my-market";

export type FollowSource = "manual" | "bid";

export interface FollowedAuction {
	id: string;
	title: string;
	rarity: Rarity;
	endAt: number;
	source: FollowSource;
	remindedAt: number | null;
}

export type FollowedAuctions = Record<string, FollowedAuction>;

const ENDED_RETENTION_MS = 24 * 60 * 60 * 1000;

export const followedAuctionsItem = storage.defineItem<FollowedAuctions>("local:followed-auctions", { fallback: {} });
export const unfollowedBidsItem = storage.defineItem<string[]>("local:unfollowed-bid-auctions", { fallback: [] });

export function isFollowedAuction(value: unknown): value is FollowedAuction {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.title === "string" &&
		typeof value.rarity === "string" &&
		isRarity(value.rarity) &&
		typeof value.endAt === "number" &&
		(value.source === "manual" || value.source === "bid") &&
		(value.remindedAt === null || typeof value.remindedAt === "number")
	);
}

export function readFollowedAuctions(value: unknown): FollowedAuction[] {
	return isRecord(value) ? Object.values(value).filter(isFollowedAuction) : [];
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
