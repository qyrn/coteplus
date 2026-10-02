import { describe, expect, it } from "vitest";
import { catalogSearchUrl, findCardIdInSearch } from "./catalog-search";

const searchResponse = {
	cards: [
		{ id: "a", wikipedia_title: "Iris Mittenaere", rarity: "L" },
		{ id: "b", wikipedia_title: "Miss Univers 2016", rarity: "R" },
		{ id: "c", wikipedia_title: "Miss Univers 2016", rarity: "SR" },
	],
};

describe("findCardIdInSearch", () => {
	it("matches the exact title and rarity", () => {
		expect(findCardIdInSearch(searchResponse, "Miss Univers 2016", "SR")).toBe(
			"c",
		);
	});

	it("falls back to the first exact title", () => {
		expect(findCardIdInSearch(searchResponse, "Miss Univers 2016", "L")).toBe(
			"b",
		);
	});

	it("ignores fuzzy matches", () => {
		expect(findCardIdInSearch(searchResponse, "Miss Univers", "R")).toBeNull();
	});

	it("reads cards nested under a card key", () => {
		const nested = {
			cards: [
				{
					card_id: "z",
					card: { id: "z", wikipedia_title: "Hibou", rarity: "PC" },
				},
			],
		};
		expect(findCardIdInSearch(nested, "Hibou", "PC")).toBe("z");
	});
});

describe("catalogSearchUrl", () => {
	it("encodes the title", () => {
		expect(catalogSearchUrl("Cléopâtre VII")).toBe(
			"/api/cards?page=0&q=Cl%C3%A9op%C3%A2tre+VII&sort=rarity",
		);
	});
});
