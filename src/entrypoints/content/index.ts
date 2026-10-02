import "./style.css";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startAveragePrices } from "../../features/prices/average-prices";
import { createPriceService } from "../../features/prices/price-service";
import { createRequestQueue } from "../../lib/net/request-queue";

export default defineContentScript({
	matches: ["https://www.wiki-masters.com/*"],
	runAt: "document_idle",
	main(ctx) {
		const siteApi = createRequestQueue({
			concurrency: 4,
			minIntervalMs: 50,
			maxRetries: 3,
			baseBackoffMs: 1000,
			fetcher: (url) =>
				fetch(new URL(url, location.origin), { credentials: "include" }),
		});
		startAveragePrices(ctx, createPriceService(siteApi));
	},
});
