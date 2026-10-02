import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { RARITIES } from "../../lib/site/rarity";
import { findStockBlock } from "./pack-stock";
import { emptyCounts, importLegacyPullStatsOnce, type PullStats, pullStatsItem, totalCards } from "./pull-stats";

const PANEL_ID = "wmp-pull-stats";
const RESET_CONFIRM_DELAY_MS = 4000;

const percentFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const countFormatter = new Intl.NumberFormat("fr-FR");

function buildRow(rarity: (typeof RARITIES)[number]): HTMLElement {
	const row = document.createElement("div");
	row.className = "wmp-pull-stats-row";
	row.dataset.rarity = rarity;
	row.style.setProperty("--wmp-rarity-color", `var(--color-rarity-${rarity.toLowerCase()})`);
	const label = document.createElement("span");
	label.className = "wmp-pull-stats-rarity";
	label.textContent = rarity;
	const bar = document.createElement("span");
	bar.className = "wmp-pull-stats-bar";
	bar.append(document.createElement("span"));
	const percent = document.createElement("span");
	percent.className = "wmp-pull-stats-percent";
	const count = document.createElement("span");
	count.className = "wmp-pull-stats-count";
	row.append(label, bar, percent, count);
	return row;
}

export function startPullStatsPanel(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	const panel = document.createElement("section");
	panel.id = PANEL_ID;
	panel.className = "wmp-pull-stats";
	panel.setAttribute("aria-label", "Drop rate de tes paquets");
	const header = document.createElement("div");
	header.className = "wmp-pull-stats-header";
	const title = document.createElement("h2");
	title.textContent = "Drop rate";
	const total = document.createElement("span");
	total.className = "wmp-pull-stats-total";
	header.append(title, total);
	const rows = RARITIES.toReversed().map(buildRow);
	const resetButton = document.createElement("button");
	resetButton.type = "button";
	resetButton.className = "wmp-pull-stats-reset";
	panel.append(header, ...rows, resetButton);

	let confirmingReset = false;
	function renderResetButton(): void {
		resetButton.textContent = confirmingReset ? "Confirmer la remise à zéro" : "Remettre à zéro";
	}
	resetButton.addEventListener("click", () => {
		if (!confirmingReset) {
			confirmingReset = true;
			renderResetButton();
			ctx.setTimeout(() => {
				confirmingReset = false;
				renderResetButton();
			}, RESET_CONFIRM_DELAY_MS);
			return;
		}
		confirmingReset = false;
		renderResetButton();
		void pullStatsItem.setValue({ counts: emptyCounts(), legacyImported: true });
	});

	function render(stats: PullStats): void {
		const cardCount = totalCards(stats.counts);
		total.textContent = `${countFormatter.format(cardCount)} carte${cardCount > 1 ? "s" : ""}`;
		for (const row of rows) {
			const rarity = RARITIES.find((candidate) => candidate === row.dataset.rarity);
			if (!rarity) continue;
			const share = cardCount > 0 ? stats.counts[rarity] / cardCount : 0;
			const [, bar, percent, count] = row.children;
			const fill = bar?.firstElementChild;
			if (fill instanceof HTMLElement) fill.style.width = `${(share * 100).toFixed(2)}%`;
			if (percent) percent.textContent = `${percentFormatter.format(share * 100)} %`;
			if (count) count.textContent = countFormatter.format(stats.counts[rarity]);
		}
	}

	renderResetButton();
	void importLegacyPullStatsOnce((key) => localStorage.getItem(key)).then(async () =>
		render(await pullStatsItem.getValue()),
	);
	const unwatch = pullStatsItem.watch(render);
	ctx.onInvalidated(unwatch);

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/pulls") return;
		const stockArea = findStockBlock(document)?.parentElement;
		if (stockArea && panel.previousElementSibling !== stockArea) stockArea.insertAdjacentElement("afterend", panel);
	});
}
