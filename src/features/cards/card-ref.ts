import type { Rarity } from "../../lib/site/rarity";

export interface CardRef {
	cardId: string;
	hideImage: boolean;
}

export interface TitledCardRef extends CardRef {
	title: string;
	rarity: Rarity;
}

export function readHideImage(card: Record<string, unknown>): boolean {
	return card.hide_image === true || card.nsfw_image === true;
}
