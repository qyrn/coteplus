import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { saveWishTarget } from "./wish-target";

const ADD_LABEL = "Ajouter à la liste de souhaits";
const ADDED_LABEL = "Retirer de la liste de souhaits";
const CONFIRMATION_TIMEOUT_MS = 8000;

interface PendingWish {
	button: HTMLButtonElement;
	card: CardView;
	startedAt: number;
}

function findCardAround(button: HTMLElement): CardView | null {
	for (let element = button.parentElement; element; element = element.parentElement) {
		const card = findCards(element)[0];
		if (card) return card;
	}
	return null;
}

export function startWishlistRedirect(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	let pending: PendingWish | null = null;

	ctx.addEventListener(
		document,
		"click",
		(event) => {
			const button = event.target instanceof Element ? event.target.closest("button") : null;
			if (!button?.textContent?.includes(ADD_LABEL)) return;
			const card = findCardAround(button);
			pending = card ? { button, card, startedAt: Date.now() } : null;
		},
		{ capture: true },
	);

	pageWatcher.subscribe(() => {
		if (!pending) return;
		if (Date.now() - pending.startedAt > CONFIRMATION_TIMEOUT_MS || !pending.button.isConnected) {
			pending = null;
			return;
		}
		if (!pending.button.textContent?.includes(ADDED_LABEL)) return;
		saveWishTarget({ title: pending.card.title, rarity: pending.card.rarity });
		pending = null;
		location.assign("/marketplace");
	});
}
