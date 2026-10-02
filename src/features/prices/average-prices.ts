import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards, readCard } from "../../lib/site/card-dom";
import { isBattleRoute } from "../../lib/site/routes";
import { findPriceBadge, type PriceBadgeState, renderPriceBadge } from "./price-badge";
import type { PriceService } from "./price-service";

const RENDERED_TITLE_ATTRIBUTE = "data-wmp-price-for";
const PRELOAD_MARGIN = "300px";

function isRenderedFor(card: CardView): boolean {
	return card.element.getAttribute(RENDERED_TITLE_ATTRIBUTE) === card.title && findPriceBadge(card.element) !== null;
}

function badgeStateFor(average: number | null): PriceBadgeState {
	return average === null ? { kind: "none" } : { kind: "price", average };
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
		renderIfStillShown(card, badgeStateFor(price.average));
		price.refreshed?.then((average) => renderIfStillShown(card, badgeStateFor(average))).catch(() => undefined);
	} catch {
		renderIfStillShown(card, { kind: "error" });
	}
}

export function startAveragePrices(ctx: ContentScriptContext, priceService: PriceService): void {
	const visibilityObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
				visibilityObserver.unobserve(entry.target);
				const card = readCard(entry.target);
				if (card && !isRenderedFor(card)) void showAveragePrice(card, priceService);
			}
		},
		{ rootMargin: PRELOAD_MARGIN },
	);

	let scanScheduled = false;
	function scanCards(): void {
		scanScheduled = false;
		if (isBattleRoute(location.pathname)) return;
		if (location.pathname === "/collection") {
			priceService.collectionIndexer.syncIfStale().catch(() => undefined);
		}
		for (const card of findCards(document.body)) {
			if (!isRenderedFor(card)) visibilityObserver.observe(card.element);
		}
	}

	function scheduleScan(): void {
		if (scanScheduled) return;
		scanScheduled = true;
		ctx.requestAnimationFrame(scanCards);
	}

	const mutationObserver = new MutationObserver(scheduleScan);
	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
	});
	ctx.onInvalidated(() => {
		mutationObserver.disconnect();
		visibilityObserver.disconnect();
	});
	scheduleScan();
}
