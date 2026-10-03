const ACTIONS_CLASS = "wmp-tile-actions";

export const AUCTION_TILE_SELECTOR = '[id^="marketplace-auction-"]';
export const TILE_ID_PREFIX = "marketplace-auction-";

export function tileActions(tile: HTMLElement): HTMLElement {
	const existing = tile.querySelector<HTMLElement>(`:scope > .${ACTIONS_CLASS}`);
	if (existing) return existing;
	const actions = document.createElement("div");
	actions.className = ACTIONS_CLASS;
	tile.append(actions);
	return actions;
}
