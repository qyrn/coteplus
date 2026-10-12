import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { amountElement, formatAmount, signedAmountText } from "../../lib/ui/amount";
import { createPanel, note } from "../../lib/ui/panel";
import { rarityTag } from "../../lib/ui/rarity-tag";
import { type OwnedCard, ownedCardsItem } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import type { PriceStats } from "../prices/price-summary";
import { collectionExtrasSlot } from "./collection-extras-slot";
import { loadMissingPrices, pricingOrder } from "./collection-pricing";
import {
	type CollectionValue,
	collectionValueHistoryItem,
	computeCollectionValue,
	dayKey,
	estimateUnpricedValue,
	raritiesByValue,
	readValueHistory,
	recordValuePoint,
	type UnpricedEstimate,
	type ValuePoint,
} from "./collection-value";
import { createSparkline } from "./value-sparkline";

const PANEL_ID = "wmp-collection-value";
const REFRESH_THROTTLE_MS = 10 * 1000;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function dateOf(point: ValuePoint): Date {
	const [year, month, day] = point.day.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function changeChip(history: readonly ValuePoint[], current: ValuePoint): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className = "wmp-chip";
	const first = history[0];
	if (!first || first.day === current.day) {
		chip.textContent = "Premier relevé aujourd'hui";
		return chip;
	}
	const difference = current.total - first.total;
	chip.dataset.tone = difference > 0 ? "good" : difference < 0 ? "bad" : "neutral";
	chip.append(amountElement(signedAmountText(difference)), ` depuis le ${dateFormatter.format(dateOf(first))}`);
	return chip;
}

function rarityLine(value: CollectionValue): HTMLParagraphElement {
	const line = document.createElement("p");
	line.className = "wmp-value-rarities";
	line.append(
		...raritiesByValue(value).map(([rarity, amount]) => {
			const entry = document.createElement("span");
			entry.append(rarityTag(rarity), amountElement(formatAmount(amount)));
			return entry;
		}),
	);
	return line;
}

function estimateLine(estimate: UnpricedEstimate, value: CollectionValue): HTMLParagraphElement[] {
	if (estimate.cards === 0) return [];
	const line = document.createElement("p");
	line.className = "wmp-row-muted";
	line.append(
		`Si tes ${formatAmount(estimate.cards)} cartes sans cote valent autant que les autres de leur rareté : `,
		amountElement(formatAmount(value.total + estimate.total), "≈ "),
	);
	return [line];
}

export function startCollectionValuePanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
): void {
	const { root: panel, meta, body } = createPanel(PANEL_ID, "Valeur de ta collection", "lineChart");
	let recordedThisVisit = false;
	let pricing: Promise<void> | null = null;
	let pricingDone = false;
	let refreshTimer: number | null = null;

	function isPricingWanted(): boolean {
		return !ctx.isInvalid && location.pathname === "/collection" && document.visibilityState === "visible";
	}

	function scheduleRefresh(): void {
		if (refreshTimer !== null) return;
		refreshTimer = ctx.setTimeout(() => {
			refreshTimer = null;
			void refresh();
		}, REFRESH_THROTTLE_MS);
	}

	function startPricingIfIdle(): void {
		if (pricing || pricingDone || !isPricingWanted()) return;
		pricing = (async () => {
			const owned = await ownedCardsItem.getValue();
			const stats = await priceService.cachedPriceStats(owned);
			const missing = pricingOrder(owned, new Set(stats.keys()));
			pricingDone = await loadMissingPrices(missing, priceService, isPricingWanted, scheduleRefresh);
		})()
			.catch(() => undefined)
			.finally(() => {
				pricing = null;
			});
	}

	async function refresh(): Promise<void> {
		const owned = await ownedCardsItem.getValue();
		if (owned.length === 0) return;
		const stats = await priceService.cachedPriceStats(owned);
		const statsOf = (card: OwnedCard): PriceStats | null => stats.get(card.cardId) ?? null;
		const value = computeCollectionValue(owned, statsOf);
		const estimate = estimateUnpricedValue(owned, statsOf);
		const point: ValuePoint = {
			day: dayKey(new Date()),
			total: value.total,
			pricedCards: value.pricedCards,
			ownedCards: value.ownedCards,
		};
		const history = recordValuePoint(readValueHistory(await collectionValueHistoryItem.getValue()), point);
		await collectionValueHistoryItem.setValue(history);
		meta.replaceChildren(amountElement(formatAmount(value.total), "≈ "));
		const headline = document.createElement("div");
		headline.className = "wmp-value-headline";
		const total = amountElement(formatAmount(value.total));
		total.classList.add("wmp-value-total");
		headline.append(total, changeChip(history, point));
		const totals = history.map((entry) => entry.total);
		const chart = totals.length >= 2 ? [createSparkline(totals, "Évolution de la valeur de ta collection")] : [];
		body.replaceChildren(
			headline,
			...chart,
			rarityLine(value),
			...estimateLine(estimate, value),
			note(
				`Cote connue pour ${formatAmount(value.pricedCards)} cartes sur ${formatAmount(value.ownedCards)}. Les cotes manquantes se chargent toutes seules tant que tu restes sur ta collection, en commençant par les plus rares.`,
			),
		);
	}

	ctx.onInvalidated(
		ownedCardsItem.watch(() => {
			pricingDone = false;
			void refresh();
		}),
	);

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/collection") {
			recordedThisVisit = false;
			return;
		}
		const slot = collectionExtrasSlot();
		if (!slot) return;
		if (panel.parentElement !== slot) slot.append(panel);
		startPricingIfIdle();
		if (recordedThisVisit) return;
		recordedThisVisit = true;
		void refresh();
	});
}
