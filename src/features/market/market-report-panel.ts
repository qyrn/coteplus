import { siteApiPausedUntilItem } from "../../lib/net/site-api-guard";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { amountElement, signedAmountText } from "../../lib/ui/amount";
import { createButton, setButtonContent } from "../../lib/ui/button";
import { icon } from "../../lib/ui/icons";
import { createPanel, note } from "../../lib/ui/panel";
import { rarityTag } from "../../lib/ui/rarity-tag";
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

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

function plural(count: number, singular: string, pluralForm: string): string {
	return `${count} ${count > 1 ? pluralForm : singular}`;
}

function comparisonText(label: string, comparison: AverageComparison, aboveIsGood: boolean): string {
	const difference = differenceFromAverage(comparison);
	if (difference === null) return `${label} : aucune cote connue pour comparer.`;
	if (difference === 0) return `${label} : pile dans la cote.`;
	const direction = difference > 0 ? "au-dessus" : "en dessous";
	const verdict = difference > 0 === aboveIsGood ? "bien joué" : "à surveiller";
	return `${label} : ${Math.abs(difference)} % ${direction} de la cote (${verdict}, sur ${plural(comparison.comparedCount, "carte", "cartes")}).`;
}

function historyRow(auction: AuctionSummary, sign: 1 | -1): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-row wmp-history-row";
	const date = document.createElement("span");
	date.className = "wmp-row-muted";
	date.textContent = dateFormatter.format(auction.endAt);
	const title = document.createElement("span");
	title.className = "wmp-row-title";
	title.textContent = auction.title;
	const amount = amountElement(signedAmountText(sign * finalPriceOf(auction)));
	amount.dataset.sign = sign > 0 ? "positive" : "negative";
	row.append(date, rarityTag(auction.rarity), title, amount);
	return row;
}

function historyList(label: string, auctions: AuctionSummary[], sign: 1 | -1): HTMLDetailsElement {
	const details = document.createElement("details");
	details.className = "wmp-subpanel";
	const summary = document.createElement("summary");
	summary.append(`${label} (${auctions.length})`, icon("chevron"));
	const list = document.createElement("ul");
	list.className = "wmp-rows";
	list.append(
		...[...auctions].sort((left, right) => right.endAt - left.endAt).map((auction) => historyRow(auction, sign)),
	);
	details.append(summary, list);
	return details;
}

function metric(label: string, amount: number, detail: string): HTMLDivElement {
	const tile = document.createElement("div");
	tile.className = "wmp-metric";
	tile.dataset.tone = amount > 0 ? "good" : amount < 0 ? "bad" : "neutral";
	const name = document.createElement("span");
	name.className = "wmp-metric-label";
	name.textContent = label;
	const value = amountElement(signedAmountText(amount));
	value.classList.add("wmp-metric-value");
	const description = document.createElement("span");
	description.className = "wmp-metric-detail";
	description.textContent = detail;
	tile.append(name, value, description);
	return tile;
}

function line(text: string): HTMLParagraphElement {
	const paragraph = document.createElement("p");
	paragraph.textContent = text;
	return paragraph;
}

export function startMarketReportPanel(
	pageWatcher: PageWatcher,
	marketFollow: MarketFollow,
	priceService: PriceService,
): void {
	const { root: panel, meta, body } = createPanel(PANEL_ID, "Ton bilan du marché", "exchange");

	async function cachedAveragesOf(auctions: AuctionSummary[]): Promise<Array<number | null>> {
		const priced = auctions.flatMap((auction) =>
			auction.cardId ? [{ cardId: auction.cardId, rarity: auction.rarity }] : [],
		);
		const stats = await priceService.cachedPriceStats(priced);
		return auctions.map((auction) => (auction.cardId ? (stats.get(auction.cardId)?.value ?? null) : null));
	}

	async function showComparison(button: HTMLButtonElement, current: MarketReport): Promise<void> {
		button.disabled = true;
		setButtonContent(button, "Comparaison en cours…");
		const [saleAverages, purchaseAverages] = await Promise.all([
			cachedAveragesOf(current.sales),
			cachedAveragesOf(current.purchases),
		]);
		const comparison = document.createElement("div");
		comparison.className = "wmp-comparison";
		comparison.append(
			line(comparisonText("Tes ventes", compareWithAverages(current.sales, saleAverages), true)),
			line(comparisonText("Tes achats", compareWithAverages(current.purchases, purchaseAverages), false)),
		);
		button.replaceWith(comparison);
	}

	function render(current: MarketReport, isCapped: boolean): void {
		const compareButton = createButton("Comparer à la cote", "soft");
		compareButton.addEventListener("click", () => void showComparison(compareButton, current));
		const unsold = current.unsoldCount > 0 ? `, ${plural(current.unsoldCount, "invendue", "invendues")}` : "";
		const metrics = document.createElement("div");
		metrics.className = "wmp-metrics";
		metrics.append(
			metric("Ventes", current.earned, `${plural(current.soldCount, "carte vendue", "cartes vendues")}${unsold}`),
			metric("Achats", -current.spent, plural(current.boughtCount, "carte achetée", "cartes achetées")),
			metric("Solde", current.net, "ventes moins achats"),
		);
		meta.replaceChildren(amountElement(signedAmountText(current.net)));
		body.replaceChildren(
			metrics,
			...(isCapped ? [note("Calculé sur les 50 dernières enchères de chaque liste.")] : []),
			compareButton,
			historyList("Détail des ventes", current.sales, 1),
			historyList("Détail des achats", current.purchases, -1),
		);
	}

	async function refresh(): Promise<void> {
		const market = await marketFollow.latestMarket();
		if (!market) {
			const isPaused = Date.now() < (await siteApiPausedUntilItem.getValue());
			meta.replaceChildren();
			body.replaceChildren(
				note(
					isPaused
						? "Bilan indisponible : Cote+ a mis ses requêtes en pause après un blocage du site. Réessaie dans un moment."
						: "Impossible de charger ton historique pour le moment. Rouvre ce panneau pour réessayer.",
				),
			);
			return;
		}
		const isCapped = market.won.length >= API_LIST_LIMIT || market.history.length >= API_LIST_LIMIT;
		render(buildMarketReport(market), isCapped);
	}

	panel.addEventListener("toggle", () => {
		if (panel.open) void refresh();
	});

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/marketplace") return;
		const slot = marketExtrasSlot();
		if (!slot || panel.parentElement === slot) return;
		slot.prepend(panel);
		void refresh();
	});
}
