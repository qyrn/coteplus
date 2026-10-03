import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { icon } from "../../lib/ui/icons";
import type { PriceService } from "../prices/price-service";
import type { LiveSettings } from "../settings/live-settings";
import { discardWarnings } from "./discard-guard";

const DIALOG_TITLE = "Défausser cette carte ?";
const CONFIRM_LABEL = "Défausser";
const LAST_COPY_TEXT = "dernière copie";
const STARRED_SELECTOR = 'button[aria-label="Retirer des favoris"]';
const CARD_OVERLAY_SELECTOR = ".fixed.inset-0";
const GUARD_CLASS = "wmp-discard-guard";
const CHECKING_CLASS = "wmp-discard-guard-checking";
const GUARD_BOX_ATTRIBUTE = "data-wmp-guard-box";
const STATE_ATTRIBUTE = "data-wmp-discard-guard";

type GuardState = "checking" | "armed" | "confirmed" | "clear";

function findDiscardDialog(): HTMLElement | null {
	const title = [...document.querySelectorAll("h3")].find((heading) => heading.textContent?.trim() === DIALOG_TITLE);
	return title?.parentElement ?? null;
}

function setState(dialog: HTMLElement, state: GuardState): void {
	dialog.setAttribute(STATE_ATTRIBUTE, state);
	const confirmButton = findConfirmButton(dialog);
	confirmButton?.setAttribute("aria-disabled", String(state === "checking" || state === "armed"));
}

function findConfirmButton(dialog: HTMLElement): HTMLButtonElement | null {
	return [...dialog.querySelectorAll("button")].find((button) => button.textContent?.trim() === CONFIRM_LABEL) ?? null;
}

function insertGuard(dialog: HTMLElement, className: string, content: HTMLElement[]): HTMLElement {
	dialog.querySelector(`[${GUARD_BOX_ATTRIBUTE}]`)?.remove();
	const guard = document.createElement("div");
	guard.className = className;
	guard.setAttribute(GUARD_BOX_ATTRIBUTE, "");
	guard.append(...content);
	const buttonsRow = findConfirmButton(dialog)?.parentElement;
	if (buttonsRow?.parentElement === dialog) buttonsRow.before(guard);
	else dialog.append(guard);
	return guard;
}

function showChecking(dialog: HTMLElement): void {
	const text = document.createElement("p");
	text.className = "wmp-note";
	text.textContent = "Vérification du prix moyen…";
	insertGuard(dialog, CHECKING_CLASS, [text]);
	setState(dialog, "checking");
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
	confirm.addEventListener("change", () => setState(dialog, confirm.checked ? "confirmed" : "armed"));
	label.append(confirm, " Je la défausse quand même");
	const guard = insertGuard(dialog, GUARD_CLASS, [title, list, label]);
	guard.setAttribute("role", "alert");
	setState(dialog, "armed");
}

function clearGuard(dialog: HTMLElement): void {
	dialog.querySelector(`[${GUARD_BOX_ATTRIBUTE}]`)?.remove();
	setState(dialog, "clear");
}

async function checkDiscard(dialog: HTMLElement, priceService: PriceService, settings: LiveSettings): Promise<void> {
	const confirmLayer = dialog.closest(CARD_OVERLAY_SELECTOR);
	const overlay = confirmLayer?.parentElement?.closest<HTMLElement>(CARD_OVERLAY_SELECTOR);
	const card = overlay ? findCards(overlay)[0] : undefined;
	if (!overlay || !card) {
		setState(dialog, "clear");
		return;
	}
	showChecking(dialog);
	const starred = overlay.querySelector(STARRED_SELECTOR) !== null;
	const lastCopy = dialog.textContent?.includes(LAST_COPY_TEXT) ?? false;
	const { average } = await priceService.getAveragePrice(card.title, card.rarity).catch(() => ({ average: null }));
	if (!dialog.isConnected) return;
	const warnings = discardWarnings({ average, starred, lastCopy }, settings.current().discardGuardMinPrice);
	if (warnings.length > 0) showWarnings(dialog, warnings);
	else clearGuard(dialog);
}

function isBlocked(event: Event): boolean {
	const button = event.target instanceof Element ? event.target.closest("button") : null;
	const dialog = button?.closest<HTMLElement>(`[${STATE_ATTRIBUTE}]`);
	if (!button || !dialog || button !== findConfirmButton(dialog)) return false;
	const state = dialog.getAttribute(STATE_ATTRIBUTE);
	return state === "checking" || state === "armed";
}

export function startDiscardGuard(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
	settings: LiveSettings,
): void {
	ctx.addEventListener(
		document,
		"click",
		(event) => {
			if (!isBlocked(event)) return;
			event.preventDefault();
			event.stopPropagation();
			const target = event.target instanceof Element ? event.target : null;
			target?.closest(`[${STATE_ATTRIBUTE}]`)?.querySelector<HTMLInputElement>(`.${GUARD_CLASS} input`)?.focus();
		},
		{ capture: true },
	);

	pageWatcher.subscribe(() => {
		const dialog = findDiscardDialog();
		if (!dialog || dialog.hasAttribute(STATE_ATTRIBUTE)) return;
		void checkDiscard(dialog, priceService, settings);
	});
}
