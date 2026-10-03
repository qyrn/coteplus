import type { OwnedCard } from "../cards/collection-index";

export interface BestSale {
	card: OwnedCard;
	average: number;
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
	averageOf: (card: OwnedCard) => number | null,
	options: BestSalesOptions,
): BestSalesView {
	const priced = owned.flatMap((card): BestSale[] => {
		const average = averageOf(card);
		if (average === null || average <= 0) return [];
		return [
			{
				card,
				average,
				sellableCopies: Math.max(0, card.copies - card.starredCopies),
				isDuplicate: card.copies >= 2,
			},
		];
	});
	const entries = priced
		.filter((sale) => sale.sellableCopies > 0 && (!options.duplicatesOnly || sale.isDuplicate))
		.sort((left, right) => right.average - left.average)
		.slice(0, options.limit);
	return { entries, pricedCards: priced.length, ownedCards: owned.length };
}
