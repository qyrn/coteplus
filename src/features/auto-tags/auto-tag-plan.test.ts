import { describe, expect, it } from "vitest";
import { countLinkChanges, planAutoTags } from "./auto-tag-plan";
import { type CollectionCopy, createAutoTagRules } from "./auto-tag-rules";

function copy(overrides: Partial<CollectionCopy>): CollectionCopy {
	return {
		userCardId: "copy",
		cardId: "card",
		rarity: "C",
		category: "",
		starred: false,
		tagIds: [],
		...overrides,
	};
}

describe("planAutoTags", () => {
	it("tags every copy of a duplicated card and drops the tag once it is unique", () => {
		const copies = [
			copy({ userCardId: "a1", cardId: "a" }),
			copy({ userCardId: "a2", cardId: "a", tagIds: ["dup"] }),
			copy({ userCardId: "b1", cardId: "b", tagIds: ["dup"] }),
		];
		const rules = createAutoTagRules(copies, () => null, 50);
		const [change] = planAutoTags(copies, [rules.duplicates], [{ id: "dup", name: "doublon" }]);
		expect(change).toMatchObject({ tagId: "dup", additions: ["a1"], removals: ["b1"] });
	});

	it("creates missing tags with only additions", () => {
		const copies = [copy({ userCardId: "x", category: "espèce de plantes" })];
		const rules = createAutoTagRules(copies, () => null, 50);
		const changes = planAutoTags(copies, [rules.category], []);
		expect(changes).toEqual([
			{ tag: { name: "Nature", color: "#4ade80" }, tagId: null, additions: ["x"], removals: [] },
		]);
	});

	it("leaves the sale tag alone when the cote is unknown and skips starred copies", () => {
		const copies = [
			copy({ userCardId: "unknown", cardId: "u", tagIds: ["sale"] }),
			copy({ userCardId: "cheap", cardId: "c", tagIds: ["sale"] }),
			copy({ userCardId: "pricey", cardId: "p" }),
			copy({ userCardId: "kept", cardId: "k", starred: true, tagIds: ["sale"] }),
		];
		const cotes = new Map([
			["c", 10],
			["p", 80],
			["k", 500],
		]);
		const rules = createAutoTagRules(copies, (entry) => cotes.get(entry.cardId) ?? null, 50);
		const [change] = planAutoTags(copies, [rules.forSale], [{ id: "sale", name: "À vendre" }]);
		expect(change).toMatchObject({ additions: ["pricey"], removals: ["cheap", "kept"] });
	});

	it("puts each copy in its category group and reports nothing when already sorted", () => {
		const copies = [copy({ userCardId: "a", category: "actrice française", tagIds: ["people"] })];
		const rules = createAutoTagRules(copies, () => null, 50);
		const changes = planAutoTags(copies, [rules.category], [{ id: "people", name: "Personnes" }]);
		expect(countLinkChanges(changes)).toBe(0);
	});
});
