import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import { type AuctionDeal, compareToCote } from "./auction-deal";
import { type AuctionSummary, readAuctionSummary } from "./my-market";

export interface RankedAuction {
	auction: AuctionSummary;
	price: number;
	cote: number | null;
	deal: AuctionDeal | null;
}

const SEARCH_LIMIT = 50;

export function wishSearchUrl(title: string): string {
	const params = new URLSearchParams({ page: "1", limit: String(SEARCH_LIMIT), sort: "recent", q: title });
	return `/api/marketplace?${params.toString()}`;
}

export function parseActiveAuctionsFor(json: unknown, title: string, now: number): AuctionSummary[] {
	const entries = isRecord(json) && Array.isArray(json.auctions) ? json.auctions : [];
	return entries
		.map(readAuctionSummary)
		.filter(
			(auction): auction is AuctionSummary =>
				auction !== null && auction.status === "active" && auction.title === title && auction.endAt > now,
		);
}

export function priceToPay(auction: AuctionSummary): number {
	return auction.currentBid ?? auction.baseAmount ?? 0;
}

export function rankAuctions(
	auctions: AuctionSummary[],
	cotes: ReadonlyArray<number | null>,
	greatDealPercent: number,
): RankedAuction[] {
	return auctions
		.map((auction, index) => {
			const cote = cotes[index] ?? null;
			const price = priceToPay(auction);
			return {
				auction,
				price,
				cote,
				deal: cote === null ? null : compareToCote(price, cote, greatDealPercent),
			};
		})
		.sort((left, right) => {
			const leftScore = left.deal?.differencePercent ?? Number.POSITIVE_INFINITY;
			const rightScore = right.deal?.differencePercent ?? Number.POSITIVE_INFINITY;
			return leftScore - rightScore || left.price - right.price;
		});
}

export async function findWishAuctions(siteApi: RequestQueue, title: string): Promise<AuctionSummary[]> {
	return parseActiveAuctionsFor(await siteApi.getJson(wishSearchUrl(title)), title, Date.now());
}
