import "./style.css";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createCardCatalog } from "../../features/cards/card-catalog";
import { startCollectionAutoSync } from "../../features/cards/collection-auto-sync";
import { createCardImageService } from "../../features/images/card-image-service";
import { startMissingImages } from "../../features/images/missing-images";
import { startMarketDeals } from "../../features/market/market-deals";
import { startMarketFollow } from "../../features/market/market-follow";
import { startMarketReportPanel } from "../../features/market/market-report-panel";
import { startPackStockWatcher } from "../../features/packs/pack-stock-watcher";
import { startPackValueRecap } from "../../features/packs/pack-value-recap";
import { startPullRevealTracker } from "../../features/packs/pull-reveal-tracker";
import { startPullStatsPanel } from "../../features/packs/pull-stats-panel";
import { createRevealWatcher } from "../../features/packs/reveal-watcher";
import { startAveragePrices } from "../../features/prices/average-prices";
import { startBulkPriceToolbar } from "../../features/prices/bulk-price-toolbar";
import { createPriceService } from "../../features/prices/price-service";
import { startTradeValues } from "../../features/trades/trade-values";
import { createRequestQueue } from "../../lib/net/request-queue";
import { createPageWatcher } from "../../lib/site/page-watcher";

const WIKIMEDIA_USER_AGENT = "WikiMastersPlus/0.1 (extension navigateur)";
const OPENVERSE_MIN_INTERVAL_MS = 4000;

export default defineContentScript({
	matches: ["https://www.wiki-masters.com/*"],
	runAt: "document_idle",
	main(ctx) {
		const siteApi = createRequestQueue({
			concurrency: 4,
			minIntervalMs: 50,
			maxRetries: 3,
			baseBackoffMs: 1000,
			fetcher: (url) => fetch(new URL(url, location.origin), { credentials: "include" }),
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
		const catalog = createCardCatalog(siteApi);
		const priceService = createPriceService(siteApi, catalog);
		const imageService = createCardImageService({ wikimediaApi, openverseApi });
		startCollectionAutoSync(pageWatcher, catalog);
		startAveragePrices(ctx, pageWatcher, priceService);
		startBulkPriceToolbar(pageWatcher, priceService);
		startMarketDeals(ctx, pageWatcher, priceService);
		const marketFollow = startMarketFollow(ctx, pageWatcher, siteApi);
		startMarketReportPanel(pageWatcher, marketFollow, priceService);
		startTradeValues(pageWatcher, priceService);
		startMissingImages(ctx, pageWatcher, catalog, imageService);
		startPackStockWatcher(pageWatcher);
		const revealWatcher = createRevealWatcher(pageWatcher);
		startPullRevealTracker(revealWatcher);
		startPackValueRecap(revealWatcher, priceService);
		startPullStatsPanel(ctx, pageWatcher);
	},
});
