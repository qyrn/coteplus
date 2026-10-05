import { browser } from "wxt/browser";
import {
	type FollowedAuction,
	followedAuctionsItem,
	readFollowedAuctions,
	stopFollowing,
} from "../../features/market/followed-auctions";
import { marketSyncedAtItem, syncFollowedAuctions } from "../../features/market/market-sync";
import { packStockItem, readPackStockState } from "../../features/packs/pack-stock-store";
import { openSitePage, SITE_ORIGIN } from "../../lib/browser/open-site-page";
import { createRequestQueue } from "../../lib/net/request-queue";
import { createSharedRequestBudget } from "../../lib/net/shared-request-budget";
import { createGuardedSiteFetcher, siteApiPausedUntilItem } from "../../lib/net/site-api-guard";
import { isShownInPopup, renderAuctionSection } from "./auction-section";
import { renderPackSection } from "./pack-section";

const REFRESH_INTERVAL_MS = 15 * 1000;
const MARKET_SYNC_MIN_AGE_MS = 60 * 1000;
const POPUP_REQUESTS_PER_MINUTE = 20;

function requireElement<TElement extends HTMLElement>(id: string, type: new () => TElement): TElement {
	const element = document.getElementById(id);
	if (!(element instanceof type)) throw new Error(`Élément manquant : ${id}`);
	return element;
}

const packElements = {
	stock: requireElement("pack-stock", HTMLParagraphElement),
	detail: requireElement("pack-detail", HTMLParagraphElement),
	meter: requireElement("pack-meter", HTMLDivElement),
};
const pauseNotice = requireElement("site-pause", HTMLParagraphElement);
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const auctionElements = {
	list: requireElement("auction-list", HTMLUListElement),
	empty: requireElement("auction-empty", HTMLParagraphElement),
};
const auctionSync = requireElement("auction-sync", HTMLParagraphElement);

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
	const auctions = readFollowedAuctions(await followedAuctionsItem.getValue()).filter((auction) =>
		isShownInPopup(auction, now),
	);
	renderAuctionSection(auctionElements, auctions, now, auctionActions);
	const syncedAt = await marketSyncedAtItem.getValue();
	auctionSync.hidden = syncedAt === 0 || !auctions.some((auction) => auction.standing !== null);
	auctionSync.textContent = `Statuts vérifiés à ${timeFormatter.format(syncedAt)}`;
}

async function syncStandingsIfStale(): Promise<void> {
	const auctions = readFollowedAuctions(await followedAuctionsItem.getValue());
	const needsUpdate = auctions.some((auction) => auction.standing !== "won" && auction.standing !== "lost");
	const isFresh = Date.now() - (await marketSyncedAtItem.getValue()) < MARKET_SYNC_MIN_AGE_MS;
	if (!needsUpdate || isFresh) return;
	const siteApi = createRequestQueue({
		concurrency: 1,
		minIntervalMs: 0,
		maxRetries: 0,
		baseBackoffMs: 0,
		fetcher: createGuardedSiteFetcher(SITE_ORIGIN, createSharedRequestBudget(POPUP_REQUESTS_PER_MINUTE)),
	});
	await syncFollowedAuctions(siteApi);
}

requireElement("open-settings", HTMLButtonElement).addEventListener("click", () => {
	void browser.runtime.openOptionsPage().then(() => window.close());
});
requireElement("open-pulls", HTMLButtonElement).addEventListener("click", () => void openAndClose("/pulls"));
requireElement("open-market", HTMLButtonElement).addEventListener("click", () => void openAndClose("/marketplace"));
packStockItem.watch(() => void render());
followedAuctionsItem.watch(() => void render());
siteApiPausedUntilItem.watch(() => void render());
marketSyncedAtItem.watch(() => void render());
setInterval(() => void render(), REFRESH_INTERVAL_MS);
void render();
void syncStandingsIfStale();
