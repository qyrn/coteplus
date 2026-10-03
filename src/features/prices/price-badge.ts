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

function coteContent(labelText: string, amountText: string): Array<Node | string> {
	const label = document.createElement("span");
	label.className = "wmp-price-badge-label";
	label.textContent = labelText;
	return [label, icon("coin"), amountText];
}

function badgeContent(state: PriceBadgeState): Array<Node | string> {
	switch (state.kind) {
		case "loading":
			return coteContent("Cote", "…");
		case "price":
			return coteContent(state.stats.basis === "recent" ? "Cote" : "Moy.", priceFormatter.format(state.stats.value));
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

const COTE_TOOLTIP = "Cote : prix médian des 20 dernières ventes de cette rareté, les plus récentes comptent davantage";
const ALL_TIME_TOOLTIP = "Moyenne de toutes les ventes de cette rareté, la cote arrive bientôt";

function priceDetails(stats: PriceStats): string[] {
	const range =
		stats.low !== null && stats.high !== null
			? `fourchette ${priceFormatter.format(stats.low)} à ${priceFormatter.format(stats.high)} W`
			: null;
	const sales = stats.salesCount === null ? null : `${priceFormatter.format(stats.salesCount)} ventes`;
	const latest = stats.latestPrice === null ? null : `dernière vente ${priceFormatter.format(stats.latestPrice)} W`;
	return [range, sales, latest].filter((detail): detail is string => detail !== null);
}

function badgeTooltip(state: PriceBadgeState): string {
	if (state.kind !== "price") return COTE_TOOLTIP;
	const base = state.stats.basis === "recent" ? COTE_TOOLTIP : ALL_TIME_TOOLTIP;
	const details = priceDetails(state.stats);
	return details.length > 0 ? `${base} (${details.join(", ")})` : base;
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
