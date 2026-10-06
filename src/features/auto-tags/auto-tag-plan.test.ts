import { describe, expect, it } from "vitest";
import { countLinkChanges, planAutoTags } from "./auto-tag-plan";
import { type CollectionCopy, createAutoTagRules } from "./auto-tag-rules";

const THRESHOLDS = { forSaleMinCote: 50, discardMaxCote: 20 };

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
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.duplicates], [{ id: "dup", name: "doublon", color: "#38bdf8" }]);
		expect(changes[0]).toMatchObject({ tagId: "dup", additions: ["a1"], removals: ["b1"] });
	});

	it("creates missing tags with only additions", () => {
		const copies = [copy({ userCardId: "x", category: "espèce de plantes" })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.category], []);
		expect(changes).toEqual([
			{ tag: { name: "Plantes & champignons", color: "#4ade80" }, tagId: null, additions: ["x"], removals: [] },
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
		const rules = createAutoTagRules(copies, (entry) => cotes.get(entry.cardId) ?? null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.forSale], [{ id: "sale", name: "À vendre", color: "#22c55e" }]);
		expect(changes[0]).toMatchObject({ additions: ["pricey"], removals: ["cheap", "kept"] });
	});

	it("marks cards under the discard cote, never favorites", () => {
		const copies = [
			copy({ userCardId: "cheap", cardId: "c" }),
			copy({ userCardId: "limit", cardId: "l" }),
			copy({ userCardId: "loved", cardId: "c", starred: true }),
			copy({ userCardId: "unknown", cardId: "u" }),
		];
		const cotes = new Map([
			["c", 5],
			["l", 20],
		]);
		const rules = createAutoTagRules(copies, (entry) => cotes.get(entry.cardId) ?? null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.discard], []);
		expect(changes).toEqual([
			{ tag: { name: "À défausser", color: "#f87171" }, tagId: null, additions: ["cheap"], removals: [] },
		]);
	});

	it("never touches a tag the player created under the same name", () => {
		const copies = [
			copy({ userCardId: "a1", cardId: "a" }),
			copy({ userCardId: "a2", cardId: "a" }),
			copy({ userCardId: "b1", cardId: "b", tagIds: ["mine"] }),
		];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const plan = planAutoTags(copies, [rules.duplicates], [{ id: "mine", name: "Doublon", color: "#f472b6" }]);
		expect(plan.changes).toEqual([]);
		expect(plan.userOwnedTags).toEqual([{ name: "Doublon", color: "#38bdf8" }]);
	});

	it("puts each copy in its category group and reports nothing when already sorted", () => {
		const copies = [copy({ userCardId: "a", category: "actrice française", tagIds: ["actors"] })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const { changes } = planAutoTags(
			copies,
			[rules.category],
			[{ id: "actors", name: "Acteurs & actrices", color: "#F472B6" }],
		);
		expect(countLinkChanges(changes)).toBe(0);
	});

	it("retires the old broad category tags the extension created, never the player's", () => {
		const copies = [copy({ userCardId: "a", category: "actrice française", tagIds: ["old", "mine"] })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const old = { id: "old", name: "Personnes", color: "#f472b6" };
		const mine = { id: "mine", name: "Lieux", color: "#60a5fa" };
		const { retiredTags } = planAutoTags(copies, [rules.category], [old, mine]);
		expect(retiredTags).toEqual([old]);
	});
});
