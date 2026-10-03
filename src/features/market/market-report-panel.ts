import type { PageWatcher } from "../../lib/site/page-watcher";
import type { PriceService } from "../prices/price-service";
import { marketExtrasSlot } from "./market-extras-slot";
import type { MarketFollow } from "./market-follow";
import {
	type AverageComparison,
	buildMarketReport,
	compareWithAverages,
	differenceFromAverage,
	type MarketReport,
} from "./market-report";
import type { AuctionSummary } from "./my-market";

const PANEL_ID = "wmp-market-report";
const API_LIST_LIMIT = 50;

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function signedAmount(amount: number): string {
	const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
	return `${sign}${amountFormatter.format(Math.abs(amount))} W`;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return `${count} ${count > 1 ? pluralForm : singular}`;
}

function comparisonText(label: string, comparison: AverageComparison, aboveIsGood: boolean): string {
	const difference = differenceFromAverage(comparison);
	if (difference === null) return `${label} : aucun prix moyen connu pour comparer.`;
	if (difference === 0) return `${label} : pile dans la moyenne.`;
	const direction = difference > 0 ? "au-dessus" : "en dessous";
	const verdict = difference > 0 === aboveIsGood ? "bien joué" : "à surveiller";
	return `${label} : ${Math.abs(difference)} % ${direction} de la moyenne (${verdict}, sur ${plural(comparison.comparedCount, "carte", "cartes")}).`;
}

function line(text: string, className?: string): HTMLParagraphElement {
	const paragraph = document.createElement("p");
	paragraph.textContent = text;
	if (className) paragraph.className = className;
	return paragraph;
}

export function startMarketReportPanel(
	pageWatcher: PageWatcher,
	marketFollow: MarketFollow,
	priceService: PriceService,
): void {
	const panel = document.createElement("details");
	panel.id = PANEL_ID;
	panel.className = "wmp-market-report";
	const summary = document.createElement("summary");
	summary.textContent = "Ton bilan du marché";
	const body = document.createElement("div");
	body.className = "wmp-market-report-body";
	panel.append(summary, body);

	async function averagesOf(auctions: AuctionSummary[]): Promise<Array<number | null>> {
		return Promise.all(
			auctions.map((auction) =>
				priceService
					.getAveragePrice(auction.title, auction.rarity)
					.then((price) => price.average)
					.catch(() => null),
			),
		);
	}

	async function showComparison(button: HTMLButtonElement, current: MarketReport): Promise<void> {
		button.disabled = true;
		button.textContent = "Comparaison en cours…";
		const [saleAverages, purchaseAverages] = await Promise.all([
			averagesOf(current.sales),
			averagesOf(current.purchases),
		]);
		button.replaceWith(
			line(comparisonText("Tes ventes", compareWithAverages(current.sales, saleAverages), true)),
			line(comparisonText("Tes achats", compareWithAverages(current.purchases, purchaseAverages), false)),
		);
	}

	function render(current: MarketReport, isCapped: boolean): void {
		const compareButton = document.createElement("button");
		compareButton.type = "button";
		compareButton.className = "wmp-market-report-compare";
		compareButton.textContent = "Comparer aux prix moyens";
		compareButton.addEventListener("click", () => void showComparison(compareButton, current));
		const unsold = current.unsoldCount > 0 ? `, ${plural(current.unsoldCount, "invendue", "invendues")}` : "";
		body.replaceChildren(
			line(`Ventes : ${plural(current.soldCount, "carte", "cartes")}, ${signedAmount(current.earned)}${unsold}`),
			line(`Achats : ${plural(current.boughtCount, "carte", "cartes")}, ${signedAmount(-current.spent)}`),
			line(`Solde : ${signedAmount(current.net)}`, "wmp-market-report-net"),
			...(isCapped ? [line("Calculé sur les 50 dernières enchères de chaque liste.", "wmp-market-report-note")] : []),
			compareButton,
		);
	}

	async function refresh(): Promise<void> {
		const market = await marketFollow.latestMarket();
		if (!market) return;
		const isCapped = market.won.length >= API_LIST_LIMIT || market.history.length >= API_LIST_LIMIT;
		render(buildMarketReport(market), isCapped);
	}

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/marketplace") return;
		const slot = marketExtrasSlot();
		if (!slot || panel.parentElement === slot) return;
		slot.prepend(panel);
		void refresh();
	});
}
