import { describe, expect, it } from "vitest";
import { packValueText } from "./pack-value-recap";

describe("packValueText", () => {
	it("shows progress while cards are being revealed", () => {
		expect(packValueText({ total: 1240, pricedCards: 2, revealedCards: 3, packSize: 5 })).toBe(
			"Valeur : 1 240 W (3/5 cartes, 1 sans prix)",
		);
	});

	it("shows the full value once every card is revealed", () => {
		expect(packValueText({ total: 87, pricedCards: 5, revealedCards: 5, packSize: 5 })).toBe("Valeur du paquet : 87 W");
	});
});
