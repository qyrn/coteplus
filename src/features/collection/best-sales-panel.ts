import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { CardCatalog } from "../cards/card-catalog";
import { ownedCardsItem } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { type BestSale, rankBestSales } from "./best-sales";
import { collectionExtrasSlot } from "./collection-extras-slot";

const PANEL_ID = "wmp-best-sales";
const LIST_LIMIT = 30;

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function copiesText(sale: BestSale): string {
	const starred = sale.card.starredCopies > 0 ? `, ${sale.card.starredCopies} en favori` : "";
	const sales = sale.salesCount === null ? "" : ` · ${amountFormatter.format(sale.salesCount)} ventes`;
	return `×${sale.card.copies}${sale.isDuplicate ? " · doublon" : ""}${starred}${sales}`;
}

function rowFor(sale: BestSale): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-best-sales-row";
	row.dataset.duplicate = String(sale.isDuplicate);
	const rarity = document.createElement("span");
	rarity.className = "wmp-best-sales-rarity";
	rarity.style.setProperty("--wmp-rarity-color", `var(--color-rarity-${sale.card.rarity.toLowerCase()})`);
	rarity.textContent = sale.card.rarity;
	const title = document.createElement("span");
	title.className = "wmp-best-sales-title";
	title.textContent = sale.card.title;
	const price = document.createElement("span");
	price.className = "wmp-best-sales-price";
	price.textContent = `≈ ${amountFormatter.format(sale.average)} W`;
	if (sale.salesCount !== null) price.title = `${amountFormatter.format(sale.salesCount)} ventes enregistrées`;
	const copies = document.createElement("span");
	copies.className = "wmp-best-sales-copies";
	copies.textContent = copiesText(sale);
	row.append(rarity, title, price, copies);
	return row;
}

export function startBestSalesPanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	catalog: CardCatalog,
	priceService: PriceService,
): void {
	const panel = document.createElement("details");
	panel.id = PANEL_ID;
	panel.className = "wmp-best-sales";
	const summary = document.createElement("summary");
	summary.textContent = "Meilleures ventes possibles";
	const duplicatesLabel = document.createElement("label");
	duplicatesLabel.className = "wmp-best-sales-filter";
	const duplicatesOnly = document.createElement("input");
	duplicatesOnly.type = "checkbox";
	duplicatesLabel.append(duplicatesOnly, " Doublons seulement");
	const list = document.createElement("ol");
	list.className = "wmp-best-sales-list";
	const note = document.createElement("p");
	note.className = "wmp-best-sales-note";
	panel.append(summary, duplicatesLabel, list, note);

	async function render(): Promise<void> {
		if (!panel.open) return;
		const owned = await ownedCardsItem.getValue();
		if (owned.length === 0) {
			list.replaceChildren();
			note.textContent = "Lecture de ta collection en cours, la liste arrive dans une minute environ.";
			void catalog.collectionIndexer.syncIfStale().then(render, () => undefined);
			return;
		}
		const stats = await priceService.cachedPriceStats(owned);
		const view = rankBestSales(owned, (card) => stats.get(card.cardId) ?? null, {
			duplicatesOnly: duplicatesOnly.checked,
			limit: LIST_LIMIT,
		});
		list.replaceChildren(...view.entries.map(rowFor));
		note.textContent = `Classement fait sur ${view.pricedCards} cartes au prix connu, sur ${view.ownedCards}. Les cartes en favori ne sont pas proposées. Les autres prix s'ajoutent quand tu parcours ta collection.`;
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
