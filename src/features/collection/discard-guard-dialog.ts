import { findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { icon } from "../../lib/ui/icons";
import { clearGuard, guardDialog, isGuarded, setGuardState, showGuardBox } from "../guards/action-guard";
import { isLocked, setLocked } from "../locks/card-locks";
import { LOCKED_NOTICE_CLASS, lockedNoticeContent } from "../locks/locked-notice";
import type { PriceService } from "../prices/price-service";
import type { LiveSettings } from "../settings/live-settings";
import { discardWarnings } from "./discard-guard";

const DIALOG_TITLE = "Défausser cette carte ?";
const CONFIRM_LABEL = "Défausser";
const LAST_COPY_TEXT = "dernière copie";
const STARRED_SELECTOR = 'button[aria-label="Retirer des favoris"]';
const CARD_OVERLAY_SELECTOR = ".fixed.inset-0";
const WARNING_CLASS = "wmp-discard-guard";
const CHECKING_CLASS = "wmp-discard-guard-checking";

function findDiscardDialog(): HTMLElement | null {
	const title = [...document.querySelectorAll("h3")].find((heading) => heading.textContent?.trim() === DIALOG_TITLE);
	return title?.parentElement ?? null;
}

function showChecking(dialog: HTMLElement): void {
	const text = document.createElement("p");
	text.className = "wmp-note";
	text.textContent = "Vérification de la cote…";
	showGuardBox(dialog, CHECKING_CLASS, [text]);
	setGuardState(dialog, "checking");
}

function showWarnings(dialog: HTMLElement, warnings: string[]): void {
	const title = document.createElement("p");
	title.className = "wmp-discard-guard-title";
	title.append(icon("alert"), "Attention avant de défausser");
	const list = document.createElement("ul");
	list.append(
		...warnings.map((warning) => {
			const item = document.createElement("li");
			item.textContent = warning;
			return item;
		}),
	);
	const label = document.createElement("label");
	const confirm = document.createElement("input");
	confirm.type = "checkbox";
	confirm.addEventListener("change", () => setGuardState(dialog, confirm.checked ? "confirmed" : "armed"));
	label.append(confirm, " Je la défausse quand même");
	showGuardBox(dialog, WARNING_CLASS, [title, list, label]).setAttribute("role", "alert");
	setGuardState(dialog, "armed");
}

async function checkDiscard(dialog: HTMLElement, priceService: PriceService, settings: LiveSettings): Promise<void> {
	const confirmLayer = dialog.closest(CARD_OVERLAY_SELECTOR);
	const overlay = confirmLayer?.parentElement?.closest<HTMLElement>(CARD_OVERLAY_SELECTOR);
	const card = overlay ? findCards(overlay)[0] : undefined;
	if (!overlay || !card) {
		clearGuard(dialog);
		return;
	}
	if (await isLocked(card.title, card.rarity)) {
		const unlock = () =>
			void setLocked(card.title, card.rarity, false).then(() => checkDiscard(dialog, priceService, settings));
		showGuardBox(dialog, LOCKED_NOTICE_CLASS, lockedNoticeContent("la défausser", unlock));
		setGuardState(dialog, "locked");
		return;
	}
	showChecking(dialog);
	const starred = overlay.querySelector(STARRED_SELECTOR) !== null;
	const lastCopy = dialog.textContent?.includes(LAST_COPY_TEXT) ?? false;
	const { value: cote } = await priceService.getPrice(card.title, card.rarity).catch(() => ({ value: null }));
	if (!dialog.isConnected) return;
	const warnings = discardWarnings({ cote, starred, lastCopy }, settings.current().discardGuardMinPrice);
	if (warnings.length > 0) showWarnings(dialog, warnings);
	else clearGuard(dialog);
}

export function startDiscardGuard(pageWatcher: PageWatcher, priceService: PriceService, settings: LiveSettings): void {
	pageWatcher.subscribe(() => {
		const dialog = findDiscardDialog();
		if (!dialog || isGuarded(dialog)) return;
		guardDialog(dialog, CONFIRM_LABEL, "checking");
		void checkDiscard(dialog, priceService, settings);
	});
}
