import type { PageWatcher } from "../../lib/site/page-watcher";
import type { PriceService } from "../prices/price-service";
import { marketExtrasSlot } from "./market-extras-slot";
import type { MarketFollow } from "./market-follow";
import {
	type AverageComparison,
	buildMarketReport,
	compareWithAverages,
	differenceFromAverage,
	finalPriceOf,
	type MarketReport,
} from "./market-report";
import type { AuctionSummary } from "./my-market";

const PANEL_ID = "wmp-market-report";
const API_LIST_LIMIT = 50;

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

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

function historyList(label: string, auctions: AuctionSummary[], sign: 1 | -1): HTMLDetailsElement {
	const details = document.createElement("details");
	details.className = "wmp-market-history";
	const summary = document.createElement("summary");
	summary.textContent = `${label} (${auctions.length})`;
	const list = document.createElement("ul");
	const rows = [...auctions]
		.sort((left, right) => right.endAt - left.endAt)
		.map((auction) => {
			const row = document.createElement("li");
			const date = document.createElement("span");
			date.className = "wmp-market-history-date";
			date.textContent = dateFormatter.format(auction.endAt);
			const rarity = document.createElement("span");
			rarity.className = "wmp-market-history-rarity";
			rarity.style.setProperty("--wmp-rarity-color", `var(--color-rarity-${auction.rarity.toLowerCase()})`);
			rarity.textContent = auction.rarity;
			const title = document.createElement("span");
			title.className = "wmp-market-history-title";
			title.textContent = auction.title;
			const amount = document.createElement("span");
			amount.className = "wmp-market-history-amount";
			amount.dataset.sign = sign > 0 ? "positive" : "negative";
			amount.textContent = signedAmount(sign * finalPriceOf(auction));
			row.append(date, rarity, title, amount);
			return row;
		});
	list.append(...rows);
	details.append(summary, list);
	return details;
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

	async function cachedAveragesOf(auctions: AuctionSummary[]): Promise<Array<number | null>> {
		const priced = auctions.flatMap((auction) =>
			auction.cardId ? [{ cardId: auction.cardId, rarity: auction.rarity }] : [],
		);
		const stats = await priceService.cachedPriceStats(priced);
		return auctions.map((auction) => (auction.cardId ? (stats.get(auction.cardId)?.average ?? null) : null));
	}

	async function showComparison(button: HTMLButtonElement, current: MarketReport): Promise<void> {
		button.disabled = true;
		button.textContent = "Comparaison en cours…";
		const [saleAverages, purchaseAverages] = await Promise.all([
			cachedAveragesOf(current.sales),
			cachedAveragesOf(current.purchases),
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
			historyList("Détail des ventes", current.sales, 1),
			historyList("Détail des achats", current.purchases, -1),
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
