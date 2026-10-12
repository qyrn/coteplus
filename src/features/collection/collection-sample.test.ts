import { describe, expect, it } from "vitest";
import type { OwnedCard } from "../cards/collection-index";
import { SAMPLE_SIZE_PER_RARITY, sampledCardIds } from "./collection-sample";

function owned(cardId: string, rarity: OwnedCard["rarity"]): OwnedCard {
	return { cardId, hideImage: false, title: cardId, rarity, copies: 1, starredCopies: 0 };
}

describe("sampledCardIds", () => {
	const collection = [
		...Array.from({ length: 100 }, (_, index) => owned(`c${index}`, "C")),
		...Array.from({ length: 5 }, (_, index) => owned(`r${index}`, "R")),
		owned("l0", "L"),
		owned("u0", "UR"),
	];

	it("draws a fixed number of cards per estimated rarity and keeps small rarities whole", () => {
		const sample = sampledCardIds(collection);
		expect([...sample].filter((cardId) => cardId.startsWith("c"))).toHaveLength(SAMPLE_SIZE_PER_RARITY);
		expect([...sample].filter((cardId) => cardId.startsWith("r"))).toHaveLength(5);
		expect(sample.has("l0") || sample.has("u0")).toBe(false);
	});

	it("draws the same cards on every visit", () => {
		expect([...sampledCardIds([...collection].reverse())].sort()).toEqual([...sampledCardIds(collection)].sort());
	});
});
