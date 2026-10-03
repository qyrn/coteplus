import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { AUCTION_TILE_SELECTOR } from "./auction-tile-actions";

const TILE_SELLER_PREFIX = "Vendu par";
const DETAIL_SELLER_PREFIX = "Mis en vente par";
const BID_HISTORY_PREFIX = "Historique des mises";
const UNKNOWN_BIDDER = "Joueur";
const PROFILE_ATTRIBUTE = "data-wmp-profile";
const DETAIL_PATH_PATTERN = /^\/marketplace\/[0-9a-f-]{36}$/i;

export function profilePath(username: string): string {
	return `/profile/${encodeURIComponent(username)}`;
}

function findLineStartingWith(root: ParentNode, prefix: string): HTMLParagraphElement | null {
	return [...root.querySelectorAll("p")].find((paragraph) => paragraph.textContent?.trim().startsWith(prefix)) ?? null;
}

export function findTileSellerName(tile: ParentNode): Text | null {
	const line = findLineStartingWith(tile, TILE_SELLER_PREFIX);
	if (!line) return null;
	const textNodes = [...line.childNodes].filter((node): node is Text => node instanceof Text);
	const nameNode = textNodes.at(-1);
	const name = nameNode?.data.trim();
	return nameNode && name && !name.startsWith(TILE_SELLER_PREFIX) ? nameNode : null;
}

function markAsProfileLink(element: HTMLElement, username: string): void {
	element.setAttribute(PROFILE_ATTRIBUTE, username);
	element.setAttribute("role", "link");
	element.tabIndex = 0;
	element.title = `Voir le profil de ${username}`;
}

function linkTileSellers(): void {
	for (const tile of document.querySelectorAll<HTMLElement>(AUCTION_TILE_SELECTOR)) {
		const nameNode = findTileSellerName(tile);
		const username = nameNode?.data.trim();
		if (!nameNode || !username || nameNode.parentElement?.hasAttribute(PROFILE_ATTRIBUTE)) continue;
		const wrapper = document.createElement("span");
		markAsProfileLink(wrapper, username);
		nameNode.replaceWith(wrapper);
		wrapper.append(nameNode);
	}
}

function linkDetailSeller(): void {
	const usernameElement = findLineStartingWith(
		document.querySelector("main") ?? document,
		DETAIL_SELLER_PREFIX,
	)?.querySelector("span");
	const username = usernameElement?.textContent?.trim();
	if (!usernameElement || !username || usernameElement.getAttribute(PROFILE_ATTRIBUTE) === username) return;
	markAsProfileLink(usernameElement, username);
}

function linkBidders(): void {
	const heading = [...document.querySelectorAll("main h2")].find((element) =>
		element.textContent?.trim().startsWith(BID_HISTORY_PREFIX),
	);
	const list = heading?.nextElementSibling;
	if (!(list instanceof HTMLUListElement)) return;
	for (const item of list.children) {
		const nameElement = item.firstElementChild;
		const username = nameElement?.textContent?.trim();
		if (!(nameElement instanceof HTMLElement) || !username || username === UNKNOWN_BIDDER) continue;
		if (nameElement.getAttribute(PROFILE_ATTRIBUTE) !== username) markAsProfileLink(nameElement, username);
	}
}

function profileTarget(event: Event): string | null {
	const target = event.target instanceof Element ? event.target.closest(`[${PROFILE_ATTRIBUTE}]`) : null;
	return target?.getAttribute(PROFILE_ATTRIBUTE) ?? null;
}

function openProfile(event: Event, username: string): void {
	event.preventDefault();
	event.stopPropagation();
	location.assign(profilePath(username));
}

export function startPlayerProfileLinks(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	ctx.addEventListener(
		document,
		"click",
		(event) => {
			const username = profileTarget(event);
			if (username) openProfile(event, username);
		},
		{ capture: true },
	);
	ctx.addEventListener(
		document,
		"keydown",
		(event) => {
			const username = event.key === "Enter" ? profileTarget(event) : null;
			if (username) openProfile(event, username);
		},
		{ capture: true },
	);

	pageWatcher.subscribe(() => {
		if (location.pathname === "/marketplace") linkTileSellers();
		else if (DETAIL_PATH_PATTERN.test(location.pathname)) {
			linkDetailSeller();
			linkBidders();
		}
	});
}
