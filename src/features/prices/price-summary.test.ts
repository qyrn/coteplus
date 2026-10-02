import { describe, expect, it } from "vitest";
import { parsePriceSummary, pickAveragePrice } from "./price-summary";

describe("parsePriceSummary", () => {
	it("keeps valid averages per rarity", () => {
		const json = {
			isPro: false,
			summary: {
				L: { average: 373 },
				XX: { average: 4 },
				R: { average: "12" },
			},
		};
		expect(parsePriceSummary(json)).toEqual({ L: 373 });
	});

	it("returns an empty summary for unexpected payloads", () => {
		expect(parsePriceSummary(null)).toEqual({});
		expect(parsePriceSummary({ summary: [] })).toEqual({});
	});
});

describe("pickAveragePrice", () => {
	it("prefers the card rarity", () => {
		expect(pickAveragePrice({ R: 40, SR: 90 }, "SR")).toBe(90);
	});

	it("falls back to the only known rarity", () => {
		expect(pickAveragePrice({ R: 40 }, "SR")).toBe(40);
	});

	it("returns null when several other rarities exist", () => {
		expect(pickAveragePrice({ R: 40, UR: 300 }, "SR")).toBeNull();
	});
});
