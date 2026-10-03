import { describe, expect, it } from "vitest";
import { parsePriceSummary, pickPriceStats } from "./price-summary";

describe("parsePriceSummary", () => {
	it("keeps averages and the Pro sale details", () => {
		const json = {
			isPro: true,
			summary: { L: { average: 372, count: 200, latest: 200 }, XX: { average: 4 }, R: { average: "12" } },
		};
		expect(parsePriceSummary(json)).toEqual({ L: { average: 372, salesCount: 200, latestPrice: 200 } });
	});

	it("leaves sale details empty for regular accounts", () => {
		expect(parsePriceSummary({ summary: { C: { average: 5 } } })).toEqual({
			C: { average: 5, salesCount: null, latestPrice: null },
		});
	});

	it("returns an empty summary for unexpected payloads", () => {
		expect(parsePriceSummary(null)).toEqual({});
		expect(parsePriceSummary({ summary: [] })).toEqual({});
	});
});

describe("pickPriceStats", () => {
	it("prefers the card rarity", () => {
		expect(pickPriceStats({ R: 40, SR: 90 }, "SR")?.average).toBe(90);
	});

	it("reads averages cached before sale details existed", () => {
		expect(pickPriceStats({ R: 40 }, "R")).toEqual({ average: 40, salesCount: null, latestPrice: null });
	});

	it("falls back to the only known rarity", () => {
		expect(pickPriceStats({ R: 40 }, "SR")?.average).toBe(40);
	});

	it("returns null when several other rarities exist", () => {
		expect(pickPriceStats({ R: 40, UR: 300 }, "SR")).toBeNull();
	});
});
