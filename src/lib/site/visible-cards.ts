import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards, readCard } from "./card-dom";
import type { PageWatcher } from "./page-watcher";
import { isBattleRoute } from "./routes";

export interface VisibleCardHandler {
	isHandled(card: CardView): boolean;
	onVisible(card: CardView): void;
}

const PRELOAD_MARGIN = "300px";

export function handleCardsWhenVisible(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	handler: VisibleCardHandler,
): void {
	const visibilityObserver = new IntersectionObserver(
		(entries) => {
			if (ctx.isInvalid) return;
			for (const entry of entries) {
				if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
				visibilityObserver.unobserve(entry.target);
				const card = readCard(entry.target);
				if (card && !handler.isHandled(card)) handler.onVisible(card);
			}
		},
		{ rootMargin: PRELOAD_MARGIN },
	);
	ctx.onInvalidated(() => visibilityObserver.disconnect());

	pageWatcher.subscribe(() => {
		if (isBattleRoute(location.pathname)) return;
		for (const card of findCards(document.body)) {
			if (!handler.isHandled(card)) visibilityObserver.observe(card.element);
		}
	});
}
