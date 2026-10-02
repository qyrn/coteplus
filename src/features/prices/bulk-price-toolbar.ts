import type { PageWatcher } from "../../lib/site/page-watcher";
import type { BulkLoadProgress, PriceService } from "./price-service";

const TOOLBAR_ID = "wmp-bulk-prices";
const SEARCH_PLACEHOLDER_PREFIX = "Rechercher";

type ToolbarState =
	| { kind: "idle" }
	| { kind: "reading-collection" }
	| { kind: "loading"; progress: BulkLoadProgress }
	| { kind: "finished"; progress: BulkLoadProgress; stopped: boolean }
	| { kind: "error" };

function findFiltersBlock(): HTMLElement | null {
	const searchInput = [...document.querySelectorAll<HTMLInputElement>("main input")].find((input) =>
		input.placeholder.startsWith(SEARCH_PLACEHOLDER_PREFIX),
	);
	return searchInput?.parentElement?.parentElement ?? null;
}

function failureSuffix(progress: BulkLoadProgress): string {
	return progress.failed > 0 ? `, ${progress.failed} en échec` : "";
}

function statusText(state: ToolbarState): string {
	switch (state.kind) {
		case "idle":
			return "Récupère le prix moyen de chaque carte de ta collection. Les prix de moins de 24 h sont gardés.";
		case "reading-collection":
			return "Lecture de la collection…";
		case "loading":
			return `Prix : ${state.progress.done} / ${state.progress.total}${failureSuffix(state.progress)}`;
		case "finished":
			return state.stopped
				? `Arrêté à ${state.progress.done} / ${state.progress.total}${failureSuffix(state.progress)}`
				: `${state.progress.total} prix à jour${failureSuffix(state.progress)}`;
		case "error":
			return "Impossible de lire la collection. Réessaie dans un instant.";
	}
}

function isRunning(state: ToolbarState): boolean {
	return state.kind === "reading-collection" || state.kind === "loading";
}

export function startBulkPriceToolbar(pageWatcher: PageWatcher, priceService: PriceService): void {
	const toolbar = document.createElement("div");
	toolbar.id = TOOLBAR_ID;
	toolbar.className = "wmp-toolbar";
	const actionButton = document.createElement("button");
	actionButton.type = "button";
	actionButton.className = "wmp-toolbar-button";
	const status = document.createElement("span");
	status.className = "wmp-toolbar-status";
	status.setAttribute("aria-live", "polite");
	toolbar.append(actionButton, status);

	let state: ToolbarState = { kind: "idle" };
	let abortController: AbortController | null = null;

	function render(nextState: ToolbarState): void {
		state = nextState;
		actionButton.textContent = isRunning(state) ? "Arrêter" : "Charger tous les prix";
		status.textContent = statusText(state);
	}

	async function loadAll(): Promise<void> {
		const controller = new AbortController();
		abortController = controller;
		render({ kind: "reading-collection" });
		try {
			const progress = await priceService.loadAllOwnedPrices({
				signal: controller.signal,
				onProgress: (current) => render({ kind: "loading", progress: current }),
			});
			render({ kind: "finished", progress, stopped: controller.signal.aborted });
		} catch {
			render({ kind: "error" });
		} finally {
			abortController = null;
		}
	}

	actionButton.addEventListener("click", () => {
		if (abortController) abortController.abort();
		else void loadAll();
	});
	render(state);

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/collection") return;
		const filtersBlock = findFiltersBlock();
		if (filtersBlock && toolbar.parentElement !== filtersBlock) filtersBlock.prepend(toolbar);
	});
}
