import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { RequestQueue } from "../../lib/net/request-queue";
import { type FollowedAuction, followedAuctionsItem, readFollowedAuctions } from "./followed-auctions";
import { marketSyncedAtItem, syncFollowedAuctions } from "./market-sync";

const MINUTE_MS = 60 * 1000;
const CHECK_TICK_MS = 15 * 1000;
const CALM_PERIOD_MS = 2 * MINUTE_MS;
const CLOSING_PERIOD_MS = 30 * 1000;
const CLOSING_WINDOW_MS = 10 * MINUTE_MS;
const SETTLEMENT_WINDOW_MS = 60 * MINUTE_MS;

function hasOpenBid(auction: FollowedAuction): boolean {
	return auction.standing === "leading" || auction.standing === "outbid";
}

function isWatched(auction: FollowedAuction, now: number): boolean {
	if (auction.endAt > now) return auction.source === "bid" || hasOpenBid(auction);
	return hasOpenBid(auction) && now - auction.endAt < SETTLEMENT_WINDOW_MS;
}

export function standingCheckPeriod(auctions: readonly FollowedAuction[], now: number): number | null {
	const watched = auctions.filter((auction) => isWatched(auction, now));
	if (watched.length === 0) return null;
	const isClosing = watched.some((auction) => auction.endAt - now < CLOSING_WINDOW_MS);
	return isClosing ? CLOSING_PERIOD_MS : CALM_PERIOD_MS;
}

export function startStandingWatch(ctx: ContentScriptContext, siteApi: RequestQueue): void {
	let checking = false;

	async function check(): Promise<void> {
		if (checking || ctx.isInvalid) return;
		const now = Date.now();
		const period = standingCheckPeriod(readFollowedAuctions(await followedAuctionsItem.getValue()), now);
		if (period === null || now - (await marketSyncedAtItem.getValue()) < period) return;
		checking = true;
		await syncFollowedAuctions(siteApi).finally(() => {
			checking = false;
		});
	}

	ctx.setInterval(() => void check(), CHECK_TICK_MS);
	void check();
}
