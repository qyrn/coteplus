import type { StillWanted } from "../../lib/net/request-queue";
import { RARITIES } from "../../lib/site/rarity";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";

function rarityRank(card: OwnedCard): number {
	return RARITIES.indexOf(card.rarity);
}

export function pricingOrder(owned: readonly OwnedCard[], pricedCardIds: ReadonlySet<string>): OwnedCard[] {
	return owned
		.filter((card) => !pricedCardIds.has(card.cardId))
		.sort((left, right) => rarityRank(right) - rarityRank(left) || right.copies - left.copies);
}

export async function loadMissingPrices(
	cards: readonly OwnedCard[],
	priceService: PriceService,
	isWanted: StillWanted,
	onLoaded: () => void,
): Promise<boolean> {
	for (const card of cards) {
		if (!isWanted()) return false;
		const loaded = await priceService.loadIfUnknown(card, isWanted).catch(() => false);
		if (loaded) onLoaded();
	}
	return true;
}
