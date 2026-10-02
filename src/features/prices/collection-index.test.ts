import { describe, expect, it } from "vitest";
import { collectionPageUrl, parseCollectionPage } from "./collection-index";

describe("parseCollectionPage", () => {
	it("extracts owned card references and the total", () => {
		const json = {
			total: 1236,
			collection: [
				{
					id: "copy-1",
					card_id: "a",
					card: { id: "a", wikipedia_title: "Benjamin  Castaldi", rarity: "L" },
				},
				{
					id: "copy-2",
					card: { id: "b", wikipedia_title: "Inconnu", rarity: "ZZ" },
				},
				{ id: "copy-3" },
			],
		};
		expect(parseCollectionPage(json)).toEqual({
			cards: [{ cardId: "a", title: "Benjamin Castaldi", rarity: "L" }],
			total: 1236,
		});
	});

	it("tolerates unexpected payloads", () => {
		expect(parseCollectionPage("oops")).toEqual({ cards: [], total: null });
	});
});

describe("collectionPageUrl", () => {
	it("asks for stats only on the first page", () => {
		expect(collectionPageUrl(0)).toBe("/api/my-collection?sort=rarity&page=0&stats=1");
		expect(collectionPageUrl(3)).toBe("/api/my-collection?sort=rarity&page=3&stats=0");
	});
});
