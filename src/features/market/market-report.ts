import type { AuctionSummary, MyMarket } from "./my-market";

export interface MarketReport {
	soldCount: number;
	unsoldCount: number;
	earned: number;
	boughtCount: number;
	spent: number;
	net: number;
	sales: AuctionSummary[];
	purchases: AuctionSummary[];
}

export interface AverageComparison {
	paidOrEarned: number;
	coteTotal: number;
	comparedCount: number;
}

function mostFrequent(values: string[]): string | null {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function finalPriceOf(auction: AuctionSummary): number {
	return auction.finalPrice ?? auction.currentBid ?? 0;
}

export function buildMarketReport(market: MyMarket): MarketReport {
	const playerId = mostFrequent(market.won.flatMap((auction) => (auction.winnerId ? [auction.winnerId] : [])));
	const purchases = market.won.filter((auction) => auction.status === "settled_sold");
	const sales = market.history.filter(
		(auction) => auction.status === "settled_sold" && (playerId === null || auction.winnerId !== playerId),
	);
	const earned = sales.reduce((sum, auction) => sum + finalPriceOf(auction), 0);
	const spent = purchases.reduce((sum, auction) => sum + finalPriceOf(auction), 0);
	return {
		soldCount: sales.length,
		unsoldCount: market.history.filter((auction) => auction.status === "settled_unsold").length,
		earned,
		boughtCount: purchases.length,
		spent,
		net: earned - spent,
		sales,
		purchases,
	};
}

export function compareWithAverages(
	auctions: AuctionSummary[],
	cotes: ReadonlyArray<number | null>,
): AverageComparison {
	return auctions.reduce<AverageComparison>(
		(comparison, auction, index) => {
			const cote = cotes[index];
			if (cote === null || cote === undefined || cote <= 0) return comparison;
			return {
				paidOrEarned: comparison.paidOrEarned + finalPriceOf(auction),
				coteTotal: comparison.coteTotal + cote,
				comparedCount: comparison.comparedCount + 1,
			};
		},
		{ paidOrEarned: 0, coteTotal: 0, comparedCount: 0 },
	);
}

export function differenceFromAverage(comparison: AverageComparison): number | null {
	if (comparison.comparedCount === 0 || comparison.coteTotal <= 0) return null;
	return Math.round((comparison.paidOrEarned / comparison.coteTotal - 1) * 100);
}
