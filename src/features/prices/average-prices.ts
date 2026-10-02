import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards, readCard } from "../../lib/site/card-dom";
import { isBattleRoute } from "../../lib/site/routes";
import { findPriceBadge, renderPriceBadge } from "./price-badge";
import type { PriceService } from "./price-service";

const RENDERED_TITLE_ATTRIBUTE = "data-wmp-price-for";
const PRELOAD_MARGIN = "300px";

function isRenderedFor(card: CardView): boolean {
	return (
		card.element.getAttribute(RENDERED_TITLE_ATTRIBUTE) === card.title &&
		findPriceBadge(card.element) !== null
	);
}

async function showAveragePrice(
	card: CardView,
	priceService: PriceService,
): Promise<void> {
	card.element.setAttribute(RENDERED_TITLE_ATTRIBUTE, card.title);
	renderPriceBadge(card.element, card.heading, { kind: "loading" });
	let state: Parameters<typeof renderPriceBadge>[2];
	try {
		const average = await priceService.getAveragePrice(card.title, card.rarity);
		state = average === null ? { kind: "none" } : { kind: "price", average };
	} catch {
		state = { kind: "error" };
	}
	const current = readCard(card.element);
	if (current?.title === card.title)
		renderPriceBadge(current.element, current.heading, state);
}

export function startAveragePrices(
	ctx: ContentScriptContext,
	priceService: PriceService,
): void {
	const visibilityObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
					continue;
				visibilityObserver.unobserve(entry.target);
				const card = readCard(entry.target);
				if (card && !isRenderedFor(card))
					void showAveragePrice(card, priceService);
			}
		},
		{ rootMargin: PRELOAD_MARGIN },
	);

	let scanScheduled = false;
	function scanCards(): void {
		scanScheduled = false;
		if (isBattleRoute(location.pathname)) return;
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
