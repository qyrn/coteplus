import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import { normalizeTitle } from "../../lib/site/card-dom";
import { isRarity, type Rarity } from "../../lib/site/rarity";

export type AuctionStatus = "active" | "settled_sold" | "settled_unsold" | "cancelled";

export interface AuctionSummary {
	id: string;
	title: string;
	rarity: Rarity;
	endAt: number;
	status: AuctionStatus;
	finalPrice: number | null;
	currentBid: number | null;
	baseAmount: number | null;
	winnerId: string | null;
}

export interface MyMarket {
	bidding: AuctionSummary[];
	won: AuctionSummary[];
	history: AuctionSummary[];
}

const AUCTION_STATUSES: readonly string[] = ["active", "settled_sold", "settled_unsold", "cancelled"];
const AUCTION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export const MY_MARKET_URL = "/api/marketplace?page=1&limit=1&mine=1";

function isAuctionStatus(value: unknown): value is AuctionStatus {
	return typeof value === "string" && AUCTION_STATUSES.includes(value);
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function readAuctionSummary(entry: unknown): AuctionSummary | null {
	if (!isRecord(entry) || !isRecord(entry.card)) return null;
	const { id, snapshot_rarity: snapshotRarity, end_at: endAtText, status } = entry;
	const title = entry.card.wikipedia_title;
	const rarity = typeof snapshotRarity === "string" ? snapshotRarity : entry.card.rarity;
	const endAt = typeof endAtText === "string" ? Date.parse(endAtText) : Number.NaN;
	if (typeof id !== "string" || !AUCTION_ID_PATTERN.test(id) || typeof title !== "string") return null;
	if (typeof rarity !== "string" || !isRarity(rarity) || !Number.isFinite(endAt) || !isAuctionStatus(status))
		return null;
	return {
		id,
		title: normalizeTitle(title),
		rarity,
		endAt,
		status,
		finalPrice: readNumber(entry.final_price),
		currentBid: readNumber(entry.current_bid),
		baseAmount: readNumber(entry.base_amount),
		winnerId: readString(entry.winner_id),
	};
}

function readAuctionList(value: unknown): AuctionSummary[] {
	return Array.isArray(value)
		? value.map(readAuctionSummary).filter((auction): auction is AuctionSummary => auction !== null)
		: [];
}

export function parseMyMarket(json: unknown): MyMarket {
	if (!isRecord(json)) return { bidding: [], won: [], history: [] };
	return {
		bidding: readAuctionList(json.bidding),
		won: readAuctionList(json.won),
		history: readAuctionList(json.history),
	};
}

export async function fetchMyMarket(siteApi: RequestQueue): Promise<MyMarket> {
	return parseMyMarket(await siteApi.getJson(MY_MARKET_URL));
}

export function auctionDetailUrl(auctionId: string): string {
	return `/api/marketplace/${encodeURIComponent(auctionId)}`;
}

export function parseAuctionDetail(json: unknown): AuctionSummary | null {
	return isRecord(json) ? readAuctionSummary(json.auction) : null;
}
