const ACTIONS_CLASS = "wmp-tile-actions";
const SELLER_LINE_PREFIX = "Vendu par";
const TILE_CONTENT_SELECTOR = ":scope > a.card-frame > div";

export const AUCTION_TILE_SELECTOR = '[id^="marketplace-auction-"]';
export const TILE_ID_PREFIX = "marketplace-auction-";

export function tileActions(tile: HTMLElement): HTMLElement {
	const content = tile.querySelector<HTMLElement>(TILE_CONTENT_SELECTOR) ?? tile;
	const actions = content.querySelector<HTMLElement>(`:scope > .${ACTIONS_CLASS}`) ?? document.createElement("div");
	actions.className = ACTIONS_CLASS;
	const sellerLine = [...content.children].find(
		(child) => child.tagName === "P" && child.textContent?.trim().startsWith(SELLER_LINE_PREFIX),
	);
	if (sellerLine) {
		if (actions.nextElementSibling !== sellerLine) sellerLine.before(actions);
	} else if (actions.parentElement !== content) {
		content.append(actions);
	}
	return actions;
}
