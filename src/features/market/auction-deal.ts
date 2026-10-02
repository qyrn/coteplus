export type DealLevel = "great" | "fair" | "expensive";

export interface AuctionDeal {
	level: DealLevel;
	differencePercent: number;
}

export interface AuctionPrice {
	element: HTMLElement;
	amount: number;
}

const ACTIVE_PRICE_LABELS = new Set(["Mise actuelle", "Mise de départ"]);
const GREAT_DEAL_THRESHOLD = -20;
const EXPENSIVE_THRESHOLD = 10;

export function compareToAverage(price: number, average: number): AuctionDeal | null {
	if (average <= 0 || price < 0) return null;
	const differencePercent = Math.round(((price - average) / average) * 100);
	const level: DealLevel =
		differencePercent <= GREAT_DEAL_THRESHOLD
			? "great"
			: differencePercent >= EXPENSIVE_THRESHOLD
				? "expensive"
				: "fair";
	return { level, differencePercent };
}

export function parseAmount(text: string): number | null {
	const digits = text.replace(/s/g, "");
	return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function readAuctionPrice(tile: ParentNode): AuctionPrice | null {
	for (const label of tile.querySelectorAll("span")) {
		if (!ACTIVE_PRICE_LABELS.has(label.textContent?.trim() ?? "")) continue;
		const value = label.nextElementSibling;
		const amount = parseAmount(value?.textContent ?? "");
		if (value instanceof HTMLElement && amount !== null) return { element: value, amount };
	}
	return null;
}

export function dealText(deal: AuctionDeal): string {
	if (deal.level === "fair") return "≈ moyenne";
	const sign = deal.differencePercent > 0 ? "+" : "−";
	return `${sign}${Math.abs(deal.differencePercent)} % vs moy.`;
}
