import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
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

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function dateOf(point: ValuePoint): Date {
	const [year, month, day] = point.day.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function changeText(history: readonly ValuePoint[], current: ValuePoint): string {
	const first = history[0];
	if (!first || first.day === current.day) return "Premier relevé aujourd'hui. La courbe se remplit jour après jour.";
	const difference = current.total - first.total;
	const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
	return `${sign}${amountFormatter.format(Math.abs(difference))} W depuis le ${dateFormatter.format(dateOf(first))}`;
}

function rarityLine(value: CollectionValue): HTMLParagraphElement {
	const line = document.createElement("p");
	line.className = "wmp-value-rarities";
	line.append(
		...raritiesByValue(value).map(([rarity, amount]) => {
			const chip = document.createElement("span");
			chip.style.setProperty("--wmp-rarity-color", `var(--color-rarity-${rarity.toLowerCase()})`);
			const label = document.createElement("strong");
			label.textContent = rarity;
			chip.append(label, ` ${amountFormatter.format(amount)} W`);
			return chip;
		}),
	);
	return line;
}

export function startCollectionValuePanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
): void {
	const panel = document.createElement("details");
	panel.id = PANEL_ID;
	panel.className = "wmp-collection-value";
	const summary = document.createElement("summary");
	summary.textContent = "Valeur de ta collection";
	const body = document.createElement("div");
	body.className = "wmp-collection-value-body";
	panel.append(summary, body);
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
		summary.textContent = `Valeur de ta collection : ≈ ${amountFormatter.format(value.total)} W`;
		const change = document.createElement("p");
		change.className = "wmp-value-change";
		change.textContent = changeText(history, point);
		const note = document.createElement("p");
		note.className = "wmp-value-note";
		note.textContent = `Prix moyens connus pour ${value.pricedCards} cartes sur ${value.ownedCards}. La valeur grimpe aussi quand de nouveaux prix s'ajoutent en parcourant le site.`;
		const totals = history.map((entry) => entry.total);
		const chart = totals.length >= 2 ? [createSparkline(totals, "Évolution de la valeur de ta collection")] : [];
		body.replaceChildren(change, ...chart, rarityLine(value), note);
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
