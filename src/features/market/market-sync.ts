import { storage } from "wxt/utils/storage";
import type { RequestQueue } from "../../lib/net/request-queue";
import { followedAuctionsItem, syncFollowedWithMarket, unfollowedBidsItem } from "./followed-auctions";
import { fetchMyMarket, type MyMarket } from "./my-market";

export const marketSyncedAtItem = storage.defineItem<number>("local:market-synced-at", { fallback: 0 });

export async function syncFollowedAuctions(siteApi: RequestQueue): Promise<MyMarket | null> {
	const market = await fetchMyMarket(siteApi).catch(() => null);
	if (!market) return null;
	const [followed, excluded] = await Promise.all([followedAuctionsItem.getValue(), unfollowedBidsItem.getValue()]);
	await followedAuctionsItem.setValue(syncFollowedWithMarket(followed, market, excluded, Date.now()));
	await marketSyncedAtItem.setValue(Date.now());
	return market;
}
