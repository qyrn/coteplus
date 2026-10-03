import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { SiteApiPausedError } from "../../lib/net/site-api-guard";
import { type CardView, readCard } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { handleCardsWhenVisible } from "../../lib/site/visible-cards";
import { findPriceBadge, type PriceBadgeState, renderPriceBadge } from "./price-badge";
import type { PriceService } from "./price-service";
import type { PriceStats } from "./price-summary";

const RENDERED_TITLE_ATTRIBUTE = "data-wmp-price-for";

function isRenderedFor(card: CardView): boolean {
	return card.element.getAttribute(RENDERED_TITLE_ATTRIBUTE) === card.title && findPriceBadge(card.element) !== null;
}

function badgeStateFor(stats: PriceStats | null): PriceBadgeState {
	return stats === null ? { kind: "none" } : { kind: "price", stats };
}

function renderIfStillShown(card: CardView, state: PriceBadgeState): void {
	const current = readCard(card.element);
	if (current?.title === card.title) renderPriceBadge(current.element, current.heading, state);
}

async function showAveragePrice(card: CardView, priceService: PriceService): Promise<void> {
	card.element.setAttribute(RENDERED_TITLE_ATTRIBUTE, card.title);
	renderPriceBadge(card.element, card.heading, { kind: "loading" });
	try {
		const price = await priceService.getAveragePrice(card.title, card.rarity);
		renderIfStillShown(card, badgeStateFor(price.stats));
		price.refreshed?.then((stats) => renderIfStillShown(card, badgeStateFor(stats))).catch(() => undefined);
	} catch (error) {
		renderIfStillShown(card, { kind: error instanceof SiteApiPausedError ? "paused" : "error" });
	}
}

export function startAveragePrices(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
): void {
	handleCardsWhenVisible(ctx, pageWatcher, {
		isHandled: isRenderedFor,
		onVisible: (card) => void showAveragePrice(card, priceService),
	});
}
