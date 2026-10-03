import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { amountElement, formatAmount, signedAmountText } from "../../lib/ui/amount";
import { createPanel, note } from "../../lib/ui/panel";
import { rarityTag } from "../../lib/ui/rarity-tag";
import { ownedCardsItem } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { collectionExtrasSlot } from "./collection-extras-slot";
import {
	type CollectionValue,
	collectionValueHistoryItem,
	computeCollectionValue,
	dayKey,
	raritiesByValue,
	readValueHistory,
	recordValuePoint,
	type ValuePoint,
} from "./collection-value";
import { createSparkline } from "./value-sparkline";

const PANEL_ID = "wmp-collection-value";

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

export function startCollectionValuePanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
): void {
	const { root: panel, meta, body } = createPanel(PANEL_ID, "Valeur de ta collection", "lineChart");
	let recordedThisVisit = false;

	async function refresh(): Promise<void> {
		const owned = await ownedCardsItem.getValue();
		if (owned.length === 0) return;
		const stats = await priceService.cachedPriceStats(owned);
		const value = computeCollectionValue(owned, (card) => stats.get(card.cardId) ?? null);
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
			note(
				`Prix moyens connus pour ${value.pricedCards} cartes sur ${value.ownedCards}. La valeur grimpe aussi quand de nouveaux prix s'ajoutent en parcourant le site.`,
			),
		);
	}

	ctx.onInvalidated(ownedCardsItem.watch(() => void refresh()));

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/collection") {
			recordedThisVisit = false;
			return;
		}
		const slot = collectionExtrasSlot();
		if (!slot) return;
		if (panel.parentElement !== slot) slot.append(panel);
		if (recordedThisVisit) return;
		recordedThisVisit = true;
		void refresh();
	});
}
