import type { PageWatcher } from "../../lib/site/page-watcher";
import { AUCTION_TILE_SELECTOR, tileActions } from "./auction-tile-actions";

const TILE_SELLER_PREFIX = "Vendu par ";
const DETAIL_SELLER_PREFIX = "Mis en vente par";
const LINK_CLASS = "wmp-seller-link";
const DETAIL_PATH_PATTERN = /^\/marketplace\/[0-9a-f-]{36}$/i;

export function profilePath(username: string): string {
	return `/profile/${encodeURIComponent(username)}`;
}

export function readTileSeller(tile: ParentNode): string | null {
	for (const paragraph of tile.querySelectorAll("p")) {
		const text = paragraph.textContent?.trim() ?? "";
		if (text.startsWith(TILE_SELLER_PREFIX)) {
			const username = text.slice(TILE_SELLER_PREFIX.length).trim();
			return username.length > 0 ? username : null;
		}
	}
	return null;
}

function createProfileLink(username: string, label: string): HTMLAnchorElement {
	const link = document.createElement("a");
	link.className = LINK_CLASS;
	link.href = profilePath(username);
	link.dataset.username = username;
	link.textContent = label;
	link.title = `Voir les cartes de ${username}`;
	return link;
}

function placeTileLinks(): void {
	for (const tile of document.querySelectorAll<HTMLElement>(AUCTION_TILE_SELECTOR)) {
		const username = readTileSeller(tile);
		if (!username) continue;
		const actions = tileActions(tile);
		const existing = actions.querySelector<HTMLAnchorElement>(`.${LINK_CLASS}`);
		if (existing?.dataset.username === username) continue;
		existing?.remove();
		actions.append(createProfileLink(username, `Profil de ${username}`));
	}
}

function placeDetailLink(): void {
	const sellerLine = [...document.querySelectorAll("main p")].find((paragraph) =>
		paragraph.textContent?.trim().startsWith(DETAIL_SELLER_PREFIX),
	);
	const usernameElement = sellerLine?.querySelector("span");
	const username = usernameElement?.textContent?.trim();
	if (!sellerLine || !usernameElement || !username) return;
	const existing = sellerLine.querySelector<HTMLAnchorElement>(`.${LINK_CLASS}`);
	if (existing?.dataset.username === username) return;
	existing?.remove();
	usernameElement.insertAdjacentElement("afterend", createProfileLink(username, "voir son profil"));
}

export function startSellerProfileLinks(pageWatcher: PageWatcher): void {
	pageWatcher.subscribe(() => {
		if (location.pathname === "/marketplace") placeTileLinks();
		else if (DETAIL_PATH_PATTERN.test(location.pathname)) placeDetailLink();
	});
}
