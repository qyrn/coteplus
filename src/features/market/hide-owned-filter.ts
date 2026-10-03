import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { storage } from "wxt/utils/storage";
import { findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { CardCatalog } from "../cards/card-catalog";
import { ownedCardsItem } from "../cards/collection-index";
import { AUCTION_TILE_SELECTOR } from "./auction-tile-actions";
import { marketExtrasSlot } from "./market-extras-slot";

const HIDDEN_CLASS = "wmp-hidden-tile";
const BROWSE_TAB_LABEL = "Parcourir";
const ACTIVE_TAB_CLASS = "border-b-2";

const hideOwnedItem = storage.defineItem<boolean>("local:market-hide-owned", { fallback: false });

function isBrowsing(): boolean {
	return [...document.querySelectorAll("main button")].some(
		(button) => button.textContent?.trim() === BROWSE_TAB_LABEL && button.classList.contains(ACTIVE_TAB_CLASS),
	);
}

export function startHideOwnedFilter(ctx: ContentScriptContext, pageWatcher: PageWatcher, catalog: CardCatalog): void {
	let enabled = false;
	let ownedTitles = new Set<string>();

	const row = document.createElement("div");
	row.className = "wmp-market-filter";
	const label = document.createElement("label");
	label.className = "wmp-switch";
	const toggle = document.createElement("input");
	toggle.type = "checkbox";
	toggle.setAttribute("role", "switch");
	label.append(toggle, "Masquer les cartes que j'ai déjà");
	const status = document.createElement("span");
	status.className = "wmp-row-muted";
	row.append(label, status);

	function apply(): void {
		if (location.pathname !== "/marketplace") return;
		const slot = marketExtrasSlot();
		if (slot && row.parentElement !== slot) slot.append(row);
		const active = enabled && isBrowsing();
		let hidden = 0;
		for (const tile of document.querySelectorAll<HTMLElement>(AUCTION_TILE_SELECTOR)) {
			const card = findCards(tile)[0];
			const hide = active && card !== undefined && ownedTitles.has(card.title);
			if (tile.classList.contains(HIDDEN_CLASS) !== hide) tile.classList.toggle(HIDDEN_CLASS, hide);
			if (hide) hidden++;
		}
		const waitingForCollection = enabled && ownedTitles.size === 0;
		status.textContent = waitingForCollection
			? "Lecture de ta collection en cours…"
			: active && hidden > 0
				? `${hidden} enchère${hidden > 1 ? "s" : ""} masquée${hidden > 1 ? "s" : ""} sur cette page`
				: "";
	}

	toggle.addEventListener("change", () => {
		void hideOwnedItem.setValue(toggle.checked);
		if (toggle.checked) void catalog.collectionIndexer.syncIfStale().catch(() => undefined);
	});
	void hideOwnedItem.getValue().then((value) => {
		enabled = value;
		toggle.checked = value;
		apply();
	});
	void ownedCardsItem.getValue().then((owned) => {
		ownedTitles = new Set(owned.map((card) => card.title));
		apply();
	});
	ctx.onInvalidated(
		hideOwnedItem.watch((value) => {
			enabled = value;
			toggle.checked = value;
			apply();
		}),
	);
	ctx.onInvalidated(
		ownedCardsItem.watch((owned) => {
			ownedTitles = new Set(owned.map((card) => card.title));
			apply();
		}),
	);
	pageWatcher.subscribe(apply);
}
