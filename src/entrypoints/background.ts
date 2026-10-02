import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { startAuctionReminders } from "../features/market/auction-reminder-background";
import { startPackAlert } from "../features/packs/pack-alert-background";
import { CACHE_NAMESPACES, RETIRED_CACHE_NAMESPACES } from "../lib/cache/namespaces";
import { purgeExpiredEntries, removeNamespaces } from "../lib/cache/ttl-store";

function purgeCaches(): void {
	void purgeExpiredEntries(Object.values(CACHE_NAMESPACES));
}

export default defineBackground(() => {
	startPackAlert();
	startAuctionReminders();
	browser.runtime.onStartup.addListener(purgeCaches);
	browser.runtime.onInstalled.addListener(() => {
		purgeCaches();
		void removeNamespaces(RETIRED_CACHE_NAMESPACES);
	});
});
