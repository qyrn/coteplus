import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { amountElement, formatAmount } from "../../lib/ui/amount";
import { createPanel, note } from "../../lib/ui/panel";
import { rarityTag } from "../../lib/ui/rarity-tag";
import type { CardCatalog } from "../cards/card-catalog";
import { ownedCardsItem } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { type BestSale, rankBestSales } from "./best-sales";
import { collectionExtrasSlot } from "./collection-extras-slot";

const PANEL_ID = "wmp-best-sales";
const LIST_LIMIT = 30;

function copiesText(sale: BestSale): string {
	const parts = [`×${sale.card.copies}`];
	if (sale.isDuplicate) parts.push("doublon");
	if (sale.card.starredCopies > 0) parts.push(`${sale.card.starredCopies} en favori`);
	if (sale.salesCount !== null) parts.push(`${formatAmount(sale.salesCount)} ventes`);
	return parts.join(" · ");
}

function rowFor(sale: BestSale): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-row wmp-best-row";
	const title = document.createElement("span");
	title.className = "wmp-row-title";
	title.textContent = sale.card.title;
	const price = amountElement(formatAmount(sale.average), "≈ ");
	if (sale.salesCount !== null) price.title = `${formatAmount(sale.salesCount)} ventes enregistrées`;
	const copies = document.createElement("span");
	copies.className = "wmp-chip wmp-best-sales-copies";
	if (sale.isDuplicate) copies.dataset.tone = "good";
	copies.textContent = copiesText(sale);
	row.append(rarityTag(sale.card.rarity), title, price, copies);
	return row;
}

export function startBestSalesPanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	catalog: CardCatalog,
	priceService: PriceService,
): void {
	const { root: panel, meta, body } = createPanel(PANEL_ID, "Meilleures ventes possibles", "trendingUp");
	const duplicatesLabel = document.createElement("label");
	duplicatesLabel.className = "wmp-switch";
	const duplicatesOnly = document.createElement("input");
	duplicatesOnly.type = "checkbox";
	duplicatesOnly.setAttribute("role", "switch");
	duplicatesLabel.append(duplicatesOnly, "Doublons seulement");
	const list = document.createElement("ol");
	list.className = "wmp-rows wmp-best-sales-list";
	const explanation = note("");
	body.append(duplicatesLabel, list, explanation);

	async function render(): Promise<void> {
		if (!panel.open) return;
		const owned = await ownedCardsItem.getValue();
		if (owned.length === 0) {
			list.replaceChildren();
			explanation.textContent = "Lecture de ta collection en cours, la liste arrive dans une minute environ.";
			void catalog.collectionIndexer.syncIfStale().then(render, () => undefined);
			return;
		}
		const stats = await priceService.cachedPriceStats(owned);
		const view = rankBestSales(owned, (card) => stats.get(card.cardId) ?? null, {
			duplicatesOnly: duplicatesOnly.checked,
			limit: LIST_LIMIT,
		});
		list.replaceChildren(...view.entries.map(rowFor));
		meta.textContent = `Top ${view.entries.length}`;
		explanation.textContent = `Classement fait sur ${view.pricedCards} cartes au prix connu, sur ${view.ownedCards}. Les cartes en favori ne sont pas proposées. Les autres prix s'ajoutent quand tu parcours ta collection.`;
	}

	panel.addEventListener("toggle", () => void render());
	duplicatesOnly.addEventListener("change", () => void render());
	ctx.onInvalidated(ownedCardsItem.watch(() => void render()));

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/collection") return;
		const slot = collectionExtrasSlot();
		if (slot && panel.parentElement !== slot) slot.prepend(panel);
	});
}
