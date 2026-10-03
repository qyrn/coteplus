import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { createButton, setButtonContent } from "../../lib/ui/button";
import { AUCTION_TILE_SELECTOR, TILE_ID_PREFIX, tileActions } from "./auction-tile-actions";
import {
	type FollowedAuctions,
	followAuction,
	followBids,
	followedAuctionsItem,
	stopFollowing,
	unfollowedBidsItem,
} from "./followed-auctions";
import { auctionDetailUrl, fetchMyMarket, type MyMarket, parseAuctionDetail } from "./my-market";

const FOLLOW_BUTTON_CLASS = "wmp-follow-button";
const DETAIL_PATH_PATTERN = /^\/marketplace\/([0-9a-f-]{36})$/i;
const BID_BUTTON_LABEL = "Miser";
const MARKET_SYNC_INTERVAL_MS = 60 * 1000;
const AFTER_BID_SYNC_DELAY_MS = 3000;

function isMarketplaceRoute(pathname: string): boolean {
	return pathname === "/marketplace" || pathname.startsWith("/marketplace/");
}

function renderFollowButton(button: HTMLButtonElement, isFollowed: boolean): void {
	setButtonContent(button, isFollowed ? "Suivie" : "Suivre", "star");
	button.setAttribute("aria-pressed", String(isFollowed));
	button.title = isFollowed ? "Ne plus suivre cette enchère" : "Recevoir un rappel avant la fin";
}

export interface MarketFollow {
	latestMarket(): Promise<MyMarket | null>;
}

export function startMarketFollow(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	siteApi: RequestQueue,
): MarketFollow {
	let followed: FollowedAuctions = {};
	let lastSyncAt = 0;
	let syncing: Promise<MyMarket | null> | null = null;
	const buttons = new Map<string, HTMLButtonElement>();

	function renderButtons(): void {
		for (const [auctionId, button] of buttons) renderFollowButton(button, auctionId in followed);
	}

	async function syncBids(): Promise<MyMarket | null> {
		lastSyncAt = Date.now();
		const market = await fetchMyMarket(siteApi).catch(() => null);
		if (market) {
			const excluded = await unfollowedBidsItem.getValue();
			await followedAuctionsItem.setValue(followBids(await followedAuctionsItem.getValue(), market.bidding, excluded));
		}
		return market;
	}

	function syncBidsIfStale(): Promise<MyMarket | null> {
		if (!syncing || Date.now() - lastSyncAt > MARKET_SYNC_INTERVAL_MS) {
			syncing = syncBids();
		}
		return syncing;
	}

	async function toggleFollow(auctionId: string): Promise<void> {
		if (auctionId in (await followedAuctionsItem.getValue())) {
			await stopFollowing(auctionId);
			return;
		}
		const auction = parseAuctionDetail(await siteApi.getJson(auctionDetailUrl(auctionId)));
		if (auction?.status !== "active") return;
		await followedAuctionsItem.setValue(followAuction(await followedAuctionsItem.getValue(), auction, "manual"));
	}

	function createFollowButton(auctionId: string): HTMLButtonElement {
		const button = createButton("Suivre", "ghost", "star");
		button.classList.add(FOLLOW_BUTTON_CLASS);
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			button.disabled = true;
			toggleFollow(auctionId)
				.catch(() => undefined)
				.finally(() => {
					button.disabled = false;
				});
		});
		renderFollowButton(button, auctionId in followed);
		buttons.set(auctionId, button);
		return button;
	}

	function buttonFor(auctionId: string): HTMLButtonElement {
		return buttons.get(auctionId) ?? createFollowButton(auctionId);
	}

	function placeTileButtons(): void {
		for (const tile of document.querySelectorAll<HTMLElement>(AUCTION_TILE_SELECTOR)) {
			const auctionId = tile.id.slice(TILE_ID_PREFIX.length);
			const button = buttonFor(auctionId);
			const actions = tileActions(tile);
			if (button.parentElement !== actions) actions.prepend(button);
		}
	}

	function placeDetailButton(auctionId: string): void {
		const heading = document.querySelector<HTMLElement>("main h1");
		const button = buttonFor(auctionId);
		if (heading && button.previousElementSibling !== heading) heading.insertAdjacentElement("afterend", button);
	}

	followedAuctionsItem.getValue().then((value) => {
		followed = value;
		renderButtons();
	});
	ctx.onInvalidated(
		followedAuctionsItem.watch((value) => {
			followed = value;
			renderButtons();
		}),
	);

	ctx.addEventListener(
		document,
		"click",
		(event) => {
			const target = event.target instanceof Element ? event.target.closest("button") : null;
			if (target?.textContent?.trim() !== BID_BUTTON_LABEL || !DETAIL_PATH_PATTERN.test(location.pathname)) return;
			ctx.setTimeout(() => {
				syncing = syncBids();
			}, AFTER_BID_SYNC_DELAY_MS);
		},
		{ capture: true },
	);

	pageWatcher.subscribe(() => {
		if (!isMarketplaceRoute(location.pathname)) return;
		void syncBidsIfStale();
		const detailId = DETAIL_PATH_PATTERN.exec(location.pathname)?.[1];
		if (detailId) placeDetailButton(detailId);
		else placeTileButtons();
	});

	return { latestMarket: syncBidsIfStale };
}
