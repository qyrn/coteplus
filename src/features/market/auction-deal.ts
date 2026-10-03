export type DealLevel = "great" | "fair" | "expensive";

export interface AuctionDeal {
	level: DealLevel;
	differencePercent: number;
}

const ACTIVE_PRICE_LABELS = new Set(["Mise actuelle", "Mise de départ"]);
const EXPENSIVE_THRESHOLD = 10;

export function compareToAverage(price: number, average: number, greatDealPercent: number): AuctionDeal | null {
	if (average <= 0 || price < 0) return null;
	const differencePercent = Math.round(((price - average) / average) * 100);
	const level: DealLevel =
		differencePercent <= -greatDealPercent ? "great" : differencePercent >= EXPENSIVE_THRESHOLD ? "expensive" : "fair";
	return { level, differencePercent };
}

export function parseAmount(text: string): number | null {
	const digits = text.replace(/\s/g, "");
	return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function readAuctionAmount(tile: ParentNode): number | null {
	for (const label of tile.querySelectorAll("span")) {
		if (!ACTIVE_PRICE_LABELS.has(label.textContent?.trim() ?? "")) continue;
		const amount = parseAmount(label.nextElementSibling?.textContent ?? "");
		if (amount !== null) return amount;
	}
	return null;
}

export function dealText(deal: AuctionDeal): string {
	if (deal.level === "fair") return "≈ moyenne";
	const sign = deal.differencePercent > 0 ? "+" : "−";
	return `${sign}${Math.abs(deal.differencePercent)} % vs moy.`;
}
