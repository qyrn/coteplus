import type { PageWatcher } from "../../lib/site/page-watcher";
import type { CardCatalog } from "./card-catalog";

export function startCollectionAutoSync(pageWatcher: PageWatcher, catalog: CardCatalog): void {
	pageWatcher.subscribe(() => {
		if (location.pathname === "/collection") catalog.collectionIndexer.syncIfStale().catch(() => undefined);
	});
}
