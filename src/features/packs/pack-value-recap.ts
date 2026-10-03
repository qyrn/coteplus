import type { PriceService } from "../prices/price-service";
import type { RevealPosition, RevealWatcher } from "./reveal-watcher";

const RECAP_CLASS = "wmp-pack-value";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export interface PackValue {
	total: number;
	pricedCards: number;
	unsoldCards: number;
	revealedCards: number;
	packSize: number;
}

const EMPTY_PACK_VALUE: PackValue = { total: 0, pricedCards: 0, unsoldCards: 0, revealedCards: 0, packSize: 0 };

export function packValueText(value: PackValue): string {
	const pendingCards = value.revealedCards - value.pricedCards - value.unsoldCards;
	const amount =
		value.pricedCards > 0 ? `${amountFormatter.format(value.total)} W` : pendingCards > 0 ? "…" : "aucune vente connue";
	const unsoldNote = value.unsoldCards > 0 ? `, ${value.unsoldCards} sans vente` : "";
	if (value.revealedCards >= value.packSize && pendingCards === 0) return `Valeur du paquet : ${amount}${unsoldNote}`;
	return `Valeur : ${amount} (${value.revealedCards}/${value.packSize} cartes${unsoldNote})`;
}

export function startPackValueRecap(revealWatcher: RevealWatcher, priceService: PriceService): void {
	const recap = document.createElement("p");
	recap.className = RECAP_CLASS;
	recap.setAttribute("aria-live", "polite");
	const chip = document.createElement("span");
	chip.className = "wmp-chip";
	chip.dataset.tone = "good";
	recap.append(chip);
	let session = 0;
	let value: PackValue = EMPTY_PACK_VALUE;

	function place(position: RevealPosition): void {
		if (recap.previousElementSibling !== position.header) position.header.insertAdjacentElement("afterend", recap);
	}

	function update(next: PackValue): void {
		value = next;
		chip.textContent = packValueText(value);
	}

	revealWatcher.subscribe((event) => {
		if (event.type === "reveal-ended") {
			session++;
			value = EMPTY_PACK_VALUE;
			recap.remove();
			return;
		}
		const eventSession = session;
		place(event.position);
		update({ ...value, revealedCards: value.revealedCards + 1, packSize: event.position.total });
		priceService
			.getPrice(event.card.title, event.card.rarity)
			.then(({ value }) => value)
			.catch(() => null)
			.then((cote) => {
				if (eventSession !== session) return;
				update(
					cote === null
						? { ...value, unsoldCards: value.unsoldCards + 1 }
						: { ...value, total: value.total + cote, pricedCards: value.pricedCards + 1 },
				);
			});
	});
}
