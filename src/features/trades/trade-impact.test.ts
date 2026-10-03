import { describe, expect, it } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import { givenImpact, ownedByTitle, receivedImpact } from "./trade-impact";

function owned(title: string, copies: number, starredCopies = 0): OwnedCard {
	return { cardId: title, hideImage: false, title, rarity: "SR", copies, starredCopies };
}

const collection = ownedByTitle([owned("Bambou", 1), owned("Procrastination", 3), owned("Agen", 2, 1)]);

describe("receivedImpact", () => {
	it("counts the cards missing from the collection", () => {
		const cards = [
			{ title: "Bambou", rarity: "SR" as const },
			{ title: "Lulu Gainsbourg", rarity: "R" as const },
		];
		expect(receivedImpact(cards, collection)).toEqual([{ text: "Nouvelles pour toi : 1 sur 2", tone: "good" }]);
	});

	it("says when every card is already owned", () => {
		expect(receivedImpact([{ title: "Agen", rarity: "SR" }], collection)).toEqual([
			{ text: "Tu as déjà toutes ces cartes", tone: "neutral" },
		]);
	});
});

describe("givenImpact", () => {
	it("flags last copies and starred cards", () => {
		const cards = [
			{ title: "Bambou", rarity: "SR" as const },
			{ title: "Agen", rarity: "SR" as const },
		];
		expect(givenImpact(cards, collection)).toEqual([
			{ text: "Ton dernier exemplaire : Bambou", tone: "warning" },
			{ text: "En favori : Agen", tone: "warning" },
		]);
	});

	it("reassures when only duplicates leave", () => {
		expect(givenImpact([{ title: "Procrastination", rarity: "SR" }], collection)).toEqual([
			{ text: "Que des doublons, tu ne perds aucune carte", tone: "good" },
		]);
	});
});
