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

function badgeText(state: PriceBadgeState): string {
	switch (state.kind) {
		case "loading":
			return "Moy. …";
		case "price":
			return `Moy. ${priceFormatter.format(state.stats.average)} W`;
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
	badge.textContent = badgeText(state);
	badge.title = badgeTooltip(state);
	if (badge.previousElementSibling !== heading) heading.insertAdjacentElement("afterend", badge);
}
