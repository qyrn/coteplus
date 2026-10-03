import { icon } from "../../lib/ui/icons";
import type { PriceStats } from "./price-summary";

export type PriceBadgeState =
	| { kind: "loading" }
	| { kind: "price"; stats: PriceStats }
	| { kind: "none" }
	| { kind: "error" }
	| { kind: "paused" };

export const PRICE_BADGE_CLASS = "wmp-price-badge";

const priceFormatter = new Intl.NumberFormat("fr-FR", {
	maximumFractionDigits: 0,
});

function averageContent(amountText: string): Array<Node | string> {
	const label = document.createElement("span");
	label.className = "wmp-price-badge-label";
	label.textContent = "Moy.";
	return [label, icon("coin"), amountText];
}

function badgeContent(state: PriceBadgeState): Array<Node | string> {
	switch (state.kind) {
		case "loading":
			return averageContent("…");
		case "price":
			return averageContent(priceFormatter.format(state.stats.average));
		default:
			return [badgeText(state)];
	}
}

function badgeText(state: Exclude<PriceBadgeState, { kind: "loading" | "price" }>): string {
	switch (state.kind) {
		case "none":
			return "Aucune vente";
		case "error":
			return "Prix indispo.";
		case "paused":
			return "Prix en pause";
	}
}

const AVERAGE_TOOLTIP = "Prix moyen des ventes aux enchères pour cette rareté";

function badgeTooltip(state: PriceBadgeState): string {
	if (state.kind !== "price") return AVERAGE_TOOLTIP;
	const details = [
		state.stats.salesCount === null ? null : `${priceFormatter.format(state.stats.salesCount)} ventes`,
		state.stats.latestPrice === null ? null : `dernière vente ${priceFormatter.format(state.stats.latestPrice)} W`,
	].filter((detail): detail is string => detail !== null);
	return details.length > 0 ? `${AVERAGE_TOOLTIP} (${details.join(", ")})` : AVERAGE_TOOLTIP;
}

export function findPriceBadge(cardElement: HTMLElement): HTMLElement | null {
	return cardElement.querySelector<HTMLElement>(`.${PRICE_BADGE_CLASS}`);
}

export function renderPriceBadge(cardElement: HTMLElement, heading: HTMLElement, state: PriceBadgeState): void {
	const badge = findPriceBadge(cardElement) ?? document.createElement("span");
	badge.className = PRICE_BADGE_CLASS;
	badge.dataset.state = state.kind;
	badge.replaceChildren(...badgeContent(state));
	badge.title = badgeTooltip(state);
	if (badge.previousElementSibling !== heading) heading.insertAdjacentElement("afterend", badge);
}
