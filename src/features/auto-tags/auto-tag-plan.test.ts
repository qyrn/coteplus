import { describe, expect, it } from "vitest";
import { countLinkChanges, planAutoTags } from "./auto-tag-plan";
import { type CollectionCopy, createAutoTagRules } from "./auto-tag-rules";

const THRESHOLDS = { forSaleMinCote: 50, discardMaxCote: 20 };
const DUPLICATE_SPEC = { name: "Doublon", color: "#38bdf8" };
const DUPLICATE = { id: "dup", ...DUPLICATE_SPEC };

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
	it("creates missing tags and tags every copy of a duplicated card", () => {
		const copies = [copy({ userCardId: "a1", cardId: "a" }), copy({ userCardId: "a2", cardId: "a" })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.duplicates], []);
		expect(changes).toEqual([{ tag: { name: "Doublon", color: "#38bdf8" }, tagId: null, additions: ["a1", "a2"] }]);
	});

	it("leaves alone every copy that already carries an auto tag", () => {
		const copies = [
			copy({ userCardId: "done", cardId: "a", tagIds: ["dup"] }),
			copy({ userCardId: "new", cardId: "a" }),
			copy({ userCardId: "cheap", cardId: "c", tagIds: ["dup"] }),
		];
		const cotes = new Map([["c", 5]]);
		const rules = createAutoTagRules(copies, (entry) => cotes.get(entry.cardId) ?? null, THRESHOLDS);
		const plan = planAutoTags(copies, [rules.duplicates, rules.discard], [DUPLICATE]);
		expect(plan.freshCopyCount).toBe(1);
		expect(plan.changes).toEqual([{ tag: DUPLICATE_SPEC, tagId: "dup", additions: ["new"] }]);
	});

	it("still sorts copies whose only auto tag is a retired one, and retires it", () => {
		const old = { id: "old", name: "Personnes", color: "#f472b6" };
		const copies = [copy({ userCardId: "a", category: "actrice française", tagIds: ["old", "dup"] })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const plan = planAutoTags(copies, [rules.category], [old, DUPLICATE]);
		expect(plan.retiredTags).toEqual([old]);
		expect(plan.changes.map((change) => change.tag.name)).toEqual(["Acteurs & actrices"]);
	});

	it("tags sale and discard by cote, never favorites or unknown cotes", () => {
		const copies = [
			copy({ userCardId: "unknown", cardId: "u" }),
			copy({ userCardId: "cheap", cardId: "c" }),
			copy({ userCardId: "middle", cardId: "m" }),
			copy({ userCardId: "pricey", cardId: "p" }),
			copy({ userCardId: "loved", cardId: "k", starred: true }),
		];
		const cotes = new Map([
			["c", 5],
			["m", 30],
			["p", 80],
			["k", 500],
		]);
		const rules = createAutoTagRules(copies, (entry) => cotes.get(entry.cardId) ?? null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.forSale, rules.discard], []);
		expect(changes.map((change) => [change.tag.name, change.additions])).toEqual([
			["À vendre", ["pricey"]],
			["À défausser", ["cheap"]],
		]);
	});

	it("gives every copy a category, falling back to Divers", () => {
		const copies = [copy({ userCardId: "x", category: "" }), copy({ userCardId: "y", category: "espèce de plantes" })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const { changes } = planAutoTags(copies, [rules.category], []);
		expect(changes.map((change) => [change.tag.name, change.additions])).toEqual([
			["Plantes & champignons", ["y"]],
			["Divers", ["x"]],
		]);
	});

	it("never touches a tag the player created under the same name", () => {
		const copies = [copy({ userCardId: "a1", cardId: "a" }), copy({ userCardId: "a2", cardId: "a" })];
		const rules = createAutoTagRules(copies, () => null, THRESHOLDS);
		const plan = planAutoTags(copies, [rules.duplicates], [{ id: "mine", name: "Doublon", color: "#f472b6" }]);
		expect(countLinkChanges(plan.changes)).toBe(0);
		expect(plan.userOwnedTags).toEqual([DUPLICATE_SPEC]);
	});
});
