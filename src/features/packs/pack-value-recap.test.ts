import { describe, expect, it } from "vitest";
import { packValueText } from "./pack-value-recap";

describe("packValueText", () => {
	it("waits for the first price instead of showing zero", () => {
		expect(packValueText({ total: 0, pricedCards: 0, unsoldCards: 0, revealedCards: 1, packSize: 5 })).toBe(
			"Valeur : … (1/5 cartes)",
		);
	});

	it("says when no revealed card has ever been sold", () => {
		expect(packValueText({ total: 0, pricedCards: 0, unsoldCards: 1, revealedCards: 1, packSize: 5 })).toBe(
			"Valeur : aucune vente connue (1/5 cartes, 1 sans vente)",
		);
	});

	it("shows progress while cards are being revealed", () => {
		expect(packValueText({ total: 1240, pricedCards: 2, unsoldCards: 1, revealedCards: 3, packSize: 5 })).toBe(
			"Valeur : 1 240 W (3/5 cartes, 1 sans vente)",
		);
	});

	it("shows the full value once every card is revealed and priced", () => {
		expect(packValueText({ total: 87, pricedCards: 5, unsoldCards: 0, revealedCards: 5, packSize: 5 })).toBe(
			"Valeur du paquet : 87 W",
		);
	});
});
