import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import { normalizeTitle } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { isRarity, type Rarity } from "../../lib/site/rarity";
import type { CardCatalog } from "../cards/card-catalog";
import { readHideImage, type TitledCardRef } from "../cards/card-ref";

const RECENT_AUCTIONS_URL = "/api/marketplace?page=1&limit=50&sort=recent";
const SEED_INTERVAL_MS = 60 * 1000;

function raritiesOf(auction: Record<string, unknown>, card: Record<string, unknown>): Rarity[] {
	const candidates = [auction.snapshot_rarity, card.rarity].filter(
		(rarity): rarity is Rarity => typeof rarity === "string" && isRarity(rarity),
	);
	return [...new Set(candidates)];
}

export function parseAuctionCards(json: unknown): TitledCardRef[] {
	const auctions = isRecord(json) && Array.isArray(json.auctions) ? json.auctions : [];
	return auctions.flatMap((auction): TitledCardRef[] => {
		if (!isRecord(auction) || !isRecord(auction.card)) return [];
		const card = auction.card;
		const cardId = typeof card.id === "string" ? card.id : auction.card_id;
		if (typeof cardId !== "string" || typeof card.wikipedia_title !== "string") return [];
		const title = normalizeTitle(card.wikipedia_title);
		const hideImage = readHideImage(card);
		return raritiesOf(auction, card).map((rarity) => ({ cardId, title, rarity, hideImage }));
	});
}

export function startMarketCardSeed(pageWatcher: PageWatcher, siteApi: RequestQueue, catalog: CardCatalog): void {
	let lastSeedAt = 0;
	pageWatcher.subscribe(() => {
		if (location.pathname !== "/marketplace" || Date.now() - lastSeedAt < SEED_INTERVAL_MS) return;
		lastSeedAt = Date.now();
		catalog.learnFrom(siteApi.getJson(RECENT_AUCTIONS_URL).then(parseAuctionCards));
	});
}
