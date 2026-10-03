export type PriceBadgeState =
	| { kind: "loading" }
	| { kind: "price"; average: number }
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
			return `Moy. ${priceFormatter.format(state.average)} W`;
		case "none":
			return "Aucune vente";
		case "error":
			return "Prix indispo.";
		case "paused":
			return "Prix en pause";
	}
}

export function findPriceBadge(cardElement: HTMLElement): HTMLElement | null {
	return cardElement.querySelector<HTMLElement>(`.${PRICE_BADGE_CLASS}`);
}

export function renderPriceBadge(cardElement: HTMLElement, heading: HTMLElement, state: PriceBadgeState): void {
	const badge = findPriceBadge(cardElement) ?? document.createElement("span");
	badge.className = PRICE_BADGE_CLASS;
	badge.dataset.state = state.kind;
	badge.textContent = badgeText(state);
	badge.title = "Prix moyen des ventes aux enchères pour cette rareté";
	if (badge.previousElementSibling !== heading) heading.insertAdjacentElement("afterend", badge);
}
