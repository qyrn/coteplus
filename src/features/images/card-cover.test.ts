import { describe, expect, it } from "vitest";
import { initialsFor } from "./card-cover";

describe("initialsFor", () => {
	it("takes the first letters of the first two words", () => {
		expect(initialsFor("Benjamin Castaldi")).toBe("BC");
	});

	it("ignores text in parentheses", () => {
		expect(initialsFor("Bambou (chanteuse)")).toBe("B");
	});

	it("handles apostrophes, hyphens and accents", () => {
		expect(initialsFor("Jean-Paul Belmondo")).toBe("JP");
		expect(initialsFor("l'Étranger")).toBe("LÉ");
	});
});
