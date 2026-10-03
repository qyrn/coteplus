import "./style.css";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createCardCatalog } from "../../features/cards/card-catalog";
import { startCollectionAutoSync } from "../../features/cards/collection-auto-sync";
import { startGlobalSearchLearner } from "../../features/cards/global-search-learner";
import { startBestSalesPanel } from "../../features/collection/best-sales-panel";
import { startCollectionValuePanel } from "../../features/collection/collection-value-panel";
import { startDiscardGuard } from "../../features/collection/discard-guard-dialog";
import { createCardImageService } from "../../features/images/card-image-service";
import { startMissingImages } from "../../features/images/missing-images";
import { startMarketCardSeed } from "../../features/market/market-card-seed";
import { startMarketDeals } from "../../features/market/market-deals";
import { startMarketFollow } from "../../features/market/market-follow";
import { startMarketReportPanel } from "../../features/market/market-report-panel";
import { startPlayerProfileLinks } from "../../features/market/player-profile-links";
import { startStandingWatch } from "../../features/market/standing-watch";
import { startWishAuctionsPanel } from "../../features/market/wish-auctions-panel";
import { startWishlistRedirect } from "../../features/market/wishlist-redirect";
import { startNotificationWatcher } from "../../features/notifications/notification-watcher";
import { startPackStockWatcher } from "../../features/packs/pack-stock-watcher";
import { startPackValueRecap } from "../../features/packs/pack-value-recap";
import { startPullRevealTracker } from "../../features/packs/pull-reveal-tracker";
import { startPullStatsPanel } from "../../features/packs/pull-stats-panel";
import { createRevealWatcher } from "../../features/packs/reveal-watcher";
import { startCoteBadges } from "../../features/prices/cote-badges";
import { createPriceService } from "../../features/prices/price-service";
import { watchLiveSettings } from "../../features/settings/live-settings";
import { startTradeValues } from "../../features/trades/trade-values";
import { createRequestQueue } from "../../lib/net/request-queue";
import { createGuardedSiteFetcher } from "../../lib/net/site-api-guard";
import { createPageWatcher } from "../../lib/site/page-watcher";

const WIKIMEDIA_USER_AGENT = "CotePlus/0.1 (extension navigateur)";
const OPENVERSE_MIN_INTERVAL_MS = 4000;
const SITE_REQUESTS_PER_MINUTE = 30;

export default defineContentScript({
	matches: ["https://www.wiki-masters.com/*"],
	runAt: "document_idle",
	main(ctx) {
		const siteApi = createRequestQueue({
			concurrency: 2,
			minIntervalMs: 400,
			maxPerMinute: SITE_REQUESTS_PER_MINUTE,
			maxRetries: 2,
			baseBackoffMs: 2000,
			fetcher: createGuardedSiteFetcher(location.origin),
		});
		const wikimediaApi = createRequestQueue({
			concurrency: 2,
			minIntervalMs: 100,
			maxRetries: 2,
			baseBackoffMs: 1000,
			fetcher: (url) => fetch(url, { credentials: "omit", headers: { "Api-User-Agent": WIKIMEDIA_USER_AGENT } }),
		});
		const openverseApi = createRequestQueue({
			concurrency: 1,
			minIntervalMs: OPENVERSE_MIN_INTERVAL_MS,
			maxRetries: 0,
			baseBackoffMs: 0,
			fetcher: (url) => fetch(url, { credentials: "omit" }),
		});
		const pageWatcher = createPageWatcher(ctx);
		const settings = watchLiveSettings(ctx);
		const catalog = createCardCatalog(siteApi);
		const priceService = createPriceService(siteApi, catalog);
		const imageService = createCardImageService({ wikimediaApi, openverseApi });
		startCollectionAutoSync(pageWatcher, catalog);
		startMarketCardSeed(pageWatcher, siteApi, catalog);
		startGlobalSearchLearner(ctx, siteApi, catalog);
		startCoteBadges(ctx, pageWatcher, priceService);
		startBestSalesPanel(ctx, pageWatcher, catalog, priceService);
		startCollectionValuePanel(ctx, pageWatcher, priceService);
		startDiscardGuard(ctx, pageWatcher, priceService, settings);
		startMarketDeals(ctx, pageWatcher, priceService, settings);
		const marketFollow = startMarketFollow(ctx, pageWatcher, siteApi);
		startStandingWatch(ctx, siteApi);
		startNotificationWatcher(pageWatcher, siteApi);
		startMarketReportPanel(pageWatcher, marketFollow, priceService);
		startWishlistRedirect(ctx, pageWatcher, settings);
		startPlayerProfileLinks(ctx, pageWatcher);
		startWishAuctionsPanel(pageWatcher, siteApi, priceService, settings);
		startTradeValues(pageWatcher, priceService);
		startMissingImages(ctx, pageWatcher, catalog, imageService);
		startPackStockWatcher(pageWatcher);
		const revealWatcher = createRevealWatcher(pageWatcher);
		startPullRevealTracker(revealWatcher);
		startPackValueRecap(revealWatcher, priceService);
		startPullStatsPanel(ctx, pageWatcher);
	},
});
