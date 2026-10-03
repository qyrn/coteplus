import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, findCards, readCard } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { showToast } from "../../lib/ui/toast";
import { clearGuard, guardDialog, isGuarded, showGuardBox } from "../guards/action-guard";
import { isLocked, lockedCardsItem, lockKey, setLocked } from "./card-locks";
import { LOCKED_NOTICE_CLASS, lockedNoticeContent } from "./locked-notice";

const LISTING_TITLE = "Mettre aux enchères";
const LISTING_CONFIRM = "Lancer l'enchère";
const SELECTION_EXIT_LABEL = "Quitter la sélection";
const BULK_DISCARD_PREFIX = "Défausser (+";
const SELECTED_RING_CLASS = "ring-4";
const CARD_SELECTOR = 'div[class*="glow-"]';

function findListingDialog(): HTMLElement | null {
	const heading = [...document.querySelectorAll("h2")].find((element) => element.textContent?.trim() === LISTING_TITLE);
	for (let element = heading?.parentElement; element; element = element.parentElement) {
		const hasConfirm = [...element.querySelectorAll("button")].some(
			(button) => button.textContent?.trim() === LISTING_CONFIRM,
		);
		if (hasConfirm) return element;
	}
	return null;
}

async function checkListing(dialog: HTMLElement): Promise<void> {
	const card = findCards(dialog)[0];
	if (!card || !(await isLocked(card.title, card.rarity))) {
		clearGuard(dialog);
		return;
	}
	const unlock = () => void setLocked(card.title, card.rarity, false).then(() => clearGuard(dialog));
	showGuardBox(dialog, LOCKED_NOTICE_CLASS, lockedNoticeContent("la mettre aux enchères", unlock));
}

function isSelectionMode(): boolean {
	return [...document.querySelectorAll("main button")].some(
		(button) => button.textContent?.trim() === SELECTION_EXIT_LABEL,
	);
}

function isSelected(card: CardView): boolean {
	return [...(card.element.parentElement?.children ?? [])].some(
		(sibling) => sibling !== card.element && sibling.classList.contains(SELECTED_RING_CLASS),
	);
}

function block(event: Event, message: string): void {
	event.preventDefault();
	event.stopPropagation();
	showToast(message);
}

export function startLockGuards(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	let locked = new Set<string>();
	void lockedCardsItem.getValue().then((keys) => {
		locked = new Set(keys);
	});
	ctx.onInvalidated(
		lockedCardsItem.watch((keys) => {
			locked = new Set(keys);
		}),
	);
	const isCardLocked = (card: CardView) => locked.has(lockKey(card.title, card.rarity));

	ctx.addEventListener(
		document,
		"click",
		(event) => {
			if (!(event.target instanceof Element) || !isSelectionMode()) return;
			const button = event.target.closest("button");
			if (button?.textContent?.trim().startsWith(BULK_DISCARD_PREFIX)) {
				const main = document.querySelector("main");
				const lockedSelected = main ? findCards(main).filter((card) => isSelected(card) && isCardLocked(card)) : [];
				if (lockedSelected.length > 0) {
					block(
						event,
						`${lockedSelected.length} carte(s) verrouillée(s) dans ta sélection : retire-les avant de défausser.`,
					);
				}
				return;
			}
			const cardElement = event.target.closest<HTMLElement>(CARD_SELECTOR);
			const card = cardElement ? readCard(cardElement) : null;
			if (card && isCardLocked(card) && !isSelected(card)) {
				block(event, "Carte verrouillée : déverrouille-la pour la sélectionner.");
			}
		},
		{ capture: true },
	);

	pageWatcher.subscribe(() => {
		const dialog = findListingDialog();
		if (!dialog || isGuarded(dialog)) return;
		guardDialog(dialog, LISTING_CONFIRM, "locked");
		void checkListing(dialog);
	});
}
