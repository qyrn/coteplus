import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards, readCard } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { createButton, setButtonContent } from "../../lib/ui/button";
import { lockedCardsItem, lockKey, setLocked } from "./card-locks";

const LOCK_BUTTON_CLASS = "wmp-lock-button";
const CARD_SELECTOR = 'div[class*="glow-"]';
const COLLECTION_PATH = "/collection";

function cardOfButton(button: HTMLElement): CardView | null {
	const element = button.closest<HTMLElement>(CARD_SELECTOR);
	return element ? readCard(element) : null;
}

function renderButton(button: HTMLButtonElement, isLocked: boolean): void {
	if (button.getAttribute("aria-pressed") === String(isLocked)) return;
	setButtonContent(
		button,
		isLocked ? "Déverrouiller cette carte" : "Verrouiller cette carte",
		isLocked ? "lock" : "lockOpen",
	);
	button.setAttribute("aria-pressed", String(isLocked));
	button.title = isLocked
		? "Carte verrouillée : impossible de la défausser ou de la mettre en vente"
		: "Verrouiller pour éviter de la défausser ou de la vendre par erreur";
}

function createLockButton(): HTMLButtonElement {
	const button = createButton("Verrouiller cette carte", "icon", "lockOpen");
	button.classList.add(LOCK_BUTTON_CLASS);
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		const card = cardOfButton(button);
		if (card) void setLocked(card.title, card.rarity, button.getAttribute("aria-pressed") !== "true");
	});
	return button;
}

export function startLockButtons(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	let locked = new Set<string>();

	function render(): void {
		if (location.pathname !== COLLECTION_PATH) return;
		const main = document.querySelector("main");
		if (!main) return;
		for (const card of findCards(main)) {
			const button =
				card.element.querySelector<HTMLButtonElement>(`:scope > .${LOCK_BUTTON_CLASS}`) ?? createLockButton();
			if (!button.isConnected) card.element.append(button);
			renderButton(button, locked.has(lockKey(card.title, card.rarity)));
		}
	}

	function update(keys: string[]): void {
		locked = new Set(keys);
		render();
	}

	void lockedCardsItem.getValue().then(update);
	ctx.onInvalidated(lockedCardsItem.watch(update));
	pageWatcher.subscribe(render);
}
