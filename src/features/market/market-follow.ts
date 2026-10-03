import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { createButton, setButtonContent } from "../../lib/ui/button";
import { AUCTION_TILE_SELECTOR, TILE_ID_PREFIX, tileActions } from "./auction-tile-actions";
import { type FollowedAuctions, followAuction, followedAuctionsItem, stopFollowing } from "./followed-auctions";
import { syncFollowedAuctions } from "./market-sync";
import { auctionDetailUrl, type MyMarket, parseAuctionDetail } from "./my-market";

const FOLLOW_BUTTON_CLASS = "wmp-follow-button";
const COMPACT_BUTTON_CLASS = "wmp-follow-compact";

type FollowPlacement = "tile" | "detail";

interface FollowButton {
	auctionId: string;
	placement: FollowPlacement;
	button: HTMLButtonElement;
}
const DETAIL_PATH_PATTERN = /^\/marketplace\/([0-9a-f-]{36})$/i;
const BID_BUTTON_LABEL = "Miser";
const MARKET_SYNC_INTERVAL_MS = 60 * 1000;
const AFTER_BID_SYNC_DELAY_MS = 3000;

function isMarketplaceRoute(pathname: string): boolean {
	return pathname === "/marketplace" || pathname.startsWith("/marketplace/");
}

function renderFollowButton({ button, placement }: FollowButton, isFollowed: boolean): void {
	const hint = isFollowed
		? "Ne plus suivre cette enchère"
		: "Suivre cette enchère pour recevoir un rappel avant la fin";
	setButtonContent(button, placement === "tile" ? hint : isFollowed ? "Suivie" : "Suivre", "star");
	button.setAttribute("aria-pressed", String(isFollowed));
	button.title = hint;
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
	const buttons = new Map<string, FollowButton>();

	function renderButtons(): void {
		for (const followButton of buttons.values()) renderFollowButton(followButton, followButton.auctionId in followed);
	}

	function syncBids(): Promise<MyMarket | null> {
		lastSyncAt = Date.now();
		return syncFollowedAuctions(siteApi);
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

	function createFollowButton(auctionId: string, placement: FollowPlacement): FollowButton {
		const button =
			placement === "tile" ? createButton("Suivre", "icon", "star") : createButton("Suivre", "ghost", "star");
		button.classList.add(FOLLOW_BUTTON_CLASS);
		if (placement === "tile") button.classList.add(COMPACT_BUTTON_CLASS);
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
		const followButton = { auctionId, placement, button };
		renderFollowButton(followButton, auctionId in followed);
		buttons.set(`${placement}:${auctionId}`, followButton);
		return followButton;
	}

	function buttonFor(auctionId: string, placement: FollowPlacement): HTMLButtonElement {
		return (buttons.get(`${placement}:${auctionId}`) ?? createFollowButton(auctionId, placement)).button;
	}

	function placeTileButtons(): void {
		for (const tile of document.querySelectorAll<HTMLElement>(AUCTION_TILE_SELECTOR)) {
			const auctionId = tile.id.slice(TILE_ID_PREFIX.length);
			const button = buttonFor(auctionId, "tile");
			const actions = tileActions(tile);
			if (actions.lastElementChild !== button) actions.append(button);
		}
	}

	function placeDetailButton(auctionId: string): void {
		const heading = document.querySelector<HTMLElement>("main h1");
		const button = buttonFor(auctionId, "detail");
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
