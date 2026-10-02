import type { PriceService } from "../prices/price-service";
import type { RevealPosition, RevealWatcher } from "./reveal-watcher";

const RECAP_CLASS = "wmp-pack-value";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

interface PackValue {
	total: number;
	pricedCards: number;
	revealedCards: number;
	packSize: number;
}

export function packValueText(value: PackValue): string {
	const amount = `${amountFormatter.format(value.total)} W`;
	const unpriced = value.revealedCards - value.pricedCards;
	const unpricedNote = unpriced > 0 ? `, ${unpriced} sans prix` : "";
	if (value.revealedCards >= value.packSize) return `Valeur du paquet : ${amount}${unpricedNote}`;
	return `Valeur : ${amount} (${value.revealedCards}/${value.packSize} cartes${unpricedNote})`;
}

export function startPackValueRecap(revealWatcher: RevealWatcher, priceService: PriceService): void {
	const recap = document.createElement("p");
	recap.className = RECAP_CLASS;
	recap.setAttribute("aria-live", "polite");
	let session = 0;
	let value: PackValue = { total: 0, pricedCards: 0, revealedCards: 0, packSize: 0 };

	function place(position: RevealPosition): void {
		if (recap.previousElementSibling !== position.header) position.header.insertAdjacentElement("afterend", recap);
	}

	revealWatcher.subscribe((event) => {
		if (event.type === "reveal-ended") {
			session++;
			value = { total: 0, pricedCards: 0, revealedCards: 0, packSize: 0 };
			recap.remove();
			return;
		}
		const eventSession = session;
		value = { ...value, revealedCards: value.revealedCards + 1, packSize: event.position.total };
		place(event.position);
		recap.textContent = packValueText(value);
		priceService
			.getAveragePrice(event.card.title, event.card.rarity)
			.then(({ average }) => {
				if (eventSession !== session || average === null) return;
				value = { ...value, total: value.total + average, pricedCards: value.pricedCards + 1 };
				recap.textContent = packValueText(value);
			})
			.catch(() => undefined);
	});
}
