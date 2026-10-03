import { estimateStock, fullStockAt, type PackStockState, PRO_REGEN_PERIOD_MS } from "../../features/packs/pack-stock";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export interface PackSectionElements {
	stock: HTMLElement;
	detail: HTMLElement;
}

export function renderPackSection(elements: PackSectionElements, state: PackStockState | null, now: number): void {
	if (!state) {
		elements.stock.textContent = "Stock inconnu";
		elements.detail.textContent = "Passe une fois sur la page Paquets du site pour lancer le suivi.";
		return;
	}
	const estimated = estimateStock(state, now);
	const pace = state.periodMs === PRO_REGEN_PERIOD_MS ? "Pro : 1 paquet / 3 min" : "1 paquet / 10 min";
	elements.stock.textContent = `${estimated} / ${state.maxStock}`;
	elements.stock.dataset.pace = pace;
	const fullAt = fullStockAt(state);
	if (estimated >= state.maxStock) {
		elements.detail.textContent = "Stock plein : la régénération est en pause tant que tu n'ouvres pas de paquet.";
	} else if (fullAt !== null) {
		elements.detail.textContent = `Plein vers ${timeFormatter.format(fullAt)} (estimation).`;
	} else {
		elements.detail.textContent = "Repasse sur la page Paquets pour mettre à jour le compte à rebours.";
	}
}
