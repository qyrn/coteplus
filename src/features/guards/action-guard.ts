import type { ContentScriptContext } from "wxt/utils/content-script-context";

export type GuardState = "checking" | "armed" | "locked" | "confirmed" | "clear";

const STATE_ATTRIBUTE = "data-wmp-guard";
const CONFIRM_ATTRIBUTE = "data-wmp-guard-confirm";
const BOX_ATTRIBUTE = "data-wmp-guard-box";
const BLOCKING_STATES: ReadonlySet<string> = new Set(["checking", "armed", "locked"]);

export function isGuarded(dialog: HTMLElement): boolean {
	return dialog.hasAttribute(STATE_ATTRIBUTE);
}

export function findConfirmButton(dialog: HTMLElement): HTMLButtonElement | null {
	const label = dialog.getAttribute(CONFIRM_ATTRIBUTE);
	return [...dialog.querySelectorAll("button")].find((button) => button.textContent?.trim() === label) ?? null;
}

export function setGuardState(dialog: HTMLElement, state: GuardState): void {
	dialog.setAttribute(STATE_ATTRIBUTE, state);
	findConfirmButton(dialog)?.setAttribute("aria-disabled", String(BLOCKING_STATES.has(state)));
}

export function guardDialog(dialog: HTMLElement, confirmLabel: string, state: GuardState): void {
	dialog.setAttribute(CONFIRM_ATTRIBUTE, confirmLabel);
	setGuardState(dialog, state);
}

export function showGuardBox(dialog: HTMLElement, className: string, content: HTMLElement[]): HTMLElement {
	dialog.querySelector(`[${BOX_ATTRIBUTE}]`)?.remove();
	const box = document.createElement("div");
	box.className = className;
	box.setAttribute(BOX_ATTRIBUTE, "");
	box.append(...content);
	const buttonsRow = findConfirmButton(dialog)?.parentElement;
	if (buttonsRow?.parentElement && dialog.contains(buttonsRow)) buttonsRow.before(box);
	else dialog.append(box);
	return box;
}

export function clearGuard(dialog: HTMLElement): void {
	dialog.querySelector(`[${BOX_ATTRIBUTE}]`)?.remove();
	setGuardState(dialog, "clear");
}

function blockedDialog(event: Event): HTMLElement | null {
	const button = event.target instanceof Element ? event.target.closest("button") : null;
	const dialog = button?.closest<HTMLElement>(`[${STATE_ATTRIBUTE}]`);
	if (!button || !dialog || button !== findConfirmButton(dialog)) return null;
	return BLOCKING_STATES.has(dialog.getAttribute(STATE_ATTRIBUTE) ?? "") ? dialog : null;
}

export function startActionGuard(ctx: ContentScriptContext): void {
	ctx.addEventListener(
		document,
		"click",
		(event) => {
			const dialog = blockedDialog(event);
			if (!dialog) return;
			event.preventDefault();
			event.stopPropagation();
			dialog.querySelector<HTMLElement>(`[${BOX_ATTRIBUTE}] input, [${BOX_ATTRIBUTE}] button`)?.focus();
		},
		{ capture: true },
	);
}
