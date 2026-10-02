import { describe, expect, it } from "vitest";
import { catalogSearchUrl, findCardInSearch } from "./catalog-search";

const searchResponse = {
	cards: [
		{ id: "a", wikipedia_title: "Iris Mittenaere", rarity: "L" },
		{ id: "b", wikipedia_title: "Miss Univers 2016", rarity: "R", hide_image: false },
		{ id: "c", wikipedia_title: "Miss Univers 2016", rarity: "SR", nsfw_image: true },
	],
};

describe("findCardInSearch", () => {
	it("matches the exact title and rarity", () => {
		expect(findCardInSearch(searchResponse, "Miss Univers 2016", "SR")).toEqual({ cardId: "c", hideImage: true });
	});

	it("falls back to the first exact title", () => {
		expect(findCardInSearch(searchResponse, "Miss Univers 2016", "L")).toEqual({ cardId: "b", hideImage: false });
	});

	it("ignores fuzzy matches", () => {
		expect(findCardInSearch(searchResponse, "Miss Univers", "R")).toBeNull();
	});

	it("reads cards nested under a card key", () => {
		const nested = {
			cards: [{ card_id: "z", card: { id: "z", wikipedia_title: "Hibou", rarity: "PC", hide_image: true } }],
		};
		expect(findCardInSearch(nested, "Hibou", "PC")).toEqual({ cardId: "z", hideImage: true });
	});
});

describe("catalogSearchUrl", () => {
	it("encodes the title", () => {
		expect(catalogSearchUrl("Cléopâtre VII")).toBe("/api/cards?page=0&q=Cl%C3%A9op%C3%A2tre+VII&sort=rarity");
	});
});
