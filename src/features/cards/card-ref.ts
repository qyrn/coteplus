export interface CardRef {
	cardId: string;
	hideImage: boolean;
}

export function readHideImage(card: Record<string, unknown>): boolean {
	return card.hide_image === true || card.nsfw_image === true;
}
