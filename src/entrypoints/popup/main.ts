import { browser } from "wxt/browser";
import {
	type FollowedAuction,
	followedAuctionsItem,
	readFollowedAuctions,
	stopFollowing,
} from "../../features/market/followed-auctions";
import { packStockItem, readPackStockState } from "../../features/packs/pack-stock-store";
import { openSitePage } from "../../lib/browser/open-site-page";
import { siteApiPausedUntilItem } from "../../lib/net/site-api-guard";
import { renderAuctionSection } from "./auction-section";
import { renderPackSection } from "./pack-section";

const REFRESH_INTERVAL_MS = 15 * 1000;

function requireElement<TElement extends HTMLElement>(id: string, type: new () => TElement): TElement {
	const element = document.getElementById(id);
	if (!(element instanceof type)) throw new Error(`Élément manquant : ${id}`);
	return element;
}

const packElements = {
	stock: requireElement("pack-stock", HTMLParagraphElement),
	detail: requireElement("pack-detail", HTMLParagraphElement),
};
const pauseNotice = requireElement("site-pause", HTMLParagraphElement);
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const auctionElements = {
	list: requireElement("auction-list", HTMLUListElement),
	empty: requireElement("auction-empty", HTMLParagraphElement),
};

async function openAndClose(path: string): Promise<void> {
	await openSitePage(path);
	window.close();
}

const auctionActions = {
	open: (auction: FollowedAuction) => void openAndClose(`/marketplace/${encodeURIComponent(auction.id)}`),
	unfollow: (auction: FollowedAuction) => void stopFollowing(auction.id),
};

async function render(): Promise<void> {
	const now = Date.now();
	const pausedUntil = await siteApiPausedUntilItem.getValue();
	pauseNotice.hidden = pausedUntil <= now;
	pauseNotice.textContent = `Le site a signalé trop de requêtes : prix en pause jusqu'à ${timeFormatter.format(pausedUntil)}.`;
	renderPackSection(packElements, await readPackStockState(), now);
	renderAuctionSection(
		auctionElements,
		readFollowedAuctions(await followedAuctionsItem.getValue()),
		now,
		auctionActions,
	);
}

requireElement("open-settings", HTMLButtonElement).addEventListener("click", () => {
	void browser.runtime.openOptionsPage().then(() => window.close());
});
requireElement("open-pulls", HTMLButtonElement).addEventListener("click", () => void openAndClose("/pulls"));
requireElement("open-market", HTMLButtonElement).addEventListener("click", () => void openAndClose("/marketplace"));
packStockItem.watch(() => void render());
followedAuctionsItem.watch(() => void render());
siteApiPausedUntilItem.watch(() => void render());
setInterval(() => void render(), REFRESH_INTERVAL_MS);
void render();
