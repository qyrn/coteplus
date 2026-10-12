import { NonRetryableError, type StillWanted } from "../../lib/net/request-queue";
import { RARITIES } from "../../lib/site/rarity";
import type { OwnedCard } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";

const PARALLEL_LOADS = 2;

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
	let nextIndex = 0;
	let interrupted = false;

	async function loadNextCards(): Promise<void> {
		while (!interrupted && nextIndex < cards.length) {
			const card = cards[nextIndex++];
			if (!card) return;
			if (!isWanted()) {
				interrupted = true;
				return;
			}
			try {
				if (await priceService.loadIfUnknown(card, isWanted)) onLoaded();
			} catch (error) {
				if (error instanceof NonRetryableError) interrupted = true;
			}
		}
	}

	await Promise.all(Array.from({ length: PARALLEL_LOADS }, loadNextCards));
	return !interrupted;
}
