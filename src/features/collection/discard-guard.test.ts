import { describe, expect, it } from "vitest";
import { discardWarnings } from "./discard-guard";

describe("discardWarnings", () => {
	it("warns when the card is worth more than the threshold", () => {
		const warnings = discardWarnings({ average: 120, starred: false, lastCopy: false }, 10);
		expect(warnings).toEqual(["Elle vaut environ 120 W aux enchères, la défausse ne rapporte que 1 W."]);
	});

	it("stays quiet for a cheap duplicate", () => {
		expect(discardWarnings({ average: 4, starred: false, lastCopy: false }, 10)).toEqual([]);
		expect(discardWarnings({ average: null, starred: false, lastCopy: true }, 10)).toEqual([]);
	});

	it("adds the last copy only next to another reason", () => {
		expect(discardWarnings({ average: null, starred: true, lastCopy: true }, 10)).toEqual([
			"Elle fait partie de tes favoris.",
			"C'est ton dernier exemplaire.",
		]);
	});
});
