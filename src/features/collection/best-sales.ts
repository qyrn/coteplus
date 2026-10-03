import type { OwnedCard } from "../cards/collection-index";
import type { PriceStats } from "../prices/price-summary";

export interface BestSale {
	card: OwnedCard;
	cote: number;
	salesCount: number | null;
	sellableCopies: number;
	isDuplicate: boolean;
}

export interface BestSalesView {
	entries: BestSale[];
	pricedCards: number;
	ownedCards: number;
}

export interface BestSalesOptions {
	duplicatesOnly: boolean;
	limit: number;
}

export function rankBestSales(
	owned: readonly OwnedCard[],
	statsOf: (card: OwnedCard) => PriceStats | null,
	options: BestSalesOptions,
): BestSalesView {
	const priced = owned.flatMap((card): BestSale[] => {
		const stats = statsOf(card);
		if (!stats || stats.value <= 0) return [];
		return [
			{
				card,
				cote: stats.value,
				salesCount: stats.salesCount,
				sellableCopies: Math.max(0, card.copies - card.starredCopies),
				isDuplicate: card.copies >= 2,
			},
		];
	});
	const entries = priced
		.filter((sale) => sale.sellableCopies > 0 && (!options.duplicatesOnly || sale.isDuplicate))
		.sort((left, right) => right.cote - left.cote)
		.slice(0, options.limit);
	return { entries, pricedCards: priced.length, ownedCards: owned.length };
}
