import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { CardCatalog } from "./card-catalog";
import { catalogSearchUrl, readSearchCards } from "./catalog-search";

const GLOBAL_COLLECTION_PATH = "/global-collection";
const SEARCH_PLACEHOLDER_PREFIX = "Rechercher";
const SEARCH_BUTTON_LABEL = "Rechercher";

function findSearchInput(): HTMLInputElement | null {
	return (
		[...document.querySelectorAll<HTMLInputElement>("main input")].find((input) =>
			input.placeholder.startsWith(SEARCH_PLACEHOLDER_PREFIX),
		) ?? null
	);
}

function isSearchSubmit(event: Event): boolean {
	if (!(event.target instanceof Element)) return false;
	if (event instanceof KeyboardEvent) return event.key === "Enter" && event.target === findSearchInput();
	return event.target.closest("button")?.textContent?.trim() === SEARCH_BUTTON_LABEL;
}

export function startGlobalSearchLearner(ctx: ContentScriptContext, siteApi: RequestQueue, catalog: CardCatalog): void {
	let learnedQuery = "";

	function learnSubmittedSearch(event: Event): void {
		if (location.pathname !== GLOBAL_COLLECTION_PATH || !isSearchSubmit(event)) return;
		const query = findSearchInput()?.value.trim() ?? "";
		if (!query || query === learnedQuery) return;
		learnedQuery = query;
		catalog.learnFrom(siteApi.getJson(catalogSearchUrl(query)).then(readSearchCards));
	}

	ctx.addEventListener(document, "keydown", learnSubmittedSearch, { capture: true });
	ctx.addEventListener(document, "click", learnSubmittedSearch, { capture: true });
}
