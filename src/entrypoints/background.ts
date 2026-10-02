import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { CACHE_NAMESPACES } from "../lib/cache/namespaces";
import { purgeExpiredEntries } from "../lib/cache/ttl-store";

function purgeCaches(): void {
	void purgeExpiredEntries(Object.values(CACHE_NAMESPACES));
}

export default defineBackground(() => {
	browser.runtime.onStartup.addListener(purgeCaches);
	browser.runtime.onInstalled.addListener(purgeCaches);
});
