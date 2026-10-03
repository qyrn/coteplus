import { describe, expect, it } from "vitest";
import { parsePriceSummary, pickPriceStats } from "./price-summary";

const allTime = (value: number, salesCount: number | null = null, latestPrice: number | null = null) => ({
	value,
	basis: "all-time",
	low: null,
	high: null,
	salesCount,
	latestPrice,
});

describe("parsePriceSummary", () => {
	it("keeps all-time averages and the Pro sale details", () => {
		const json = {
			isPro: true,
			summary: { L: { average: 372, count: 200, latest: 200 }, XX: { average: 4 }, R: { average: "12" } },
		};
		expect(parsePriceSummary(json)).toEqual({ L: allTime(372, 200, 200) });
	});

	it("returns an empty sheet for unexpected payloads", () => {
		expect(parsePriceSummary(null)).toEqual({});
		expect(parsePriceSummary({ summary: [] })).toEqual({});
	});
});

describe("pickPriceStats", () => {
	it("prefers the card rarity", () => {
		expect(pickPriceStats({ R: allTime(40), SR: allTime(90) }, "SR")?.value).toBe(90);
	});

	it("reads both legacy cache formats", () => {
		expect(pickPriceStats({ R: 40 }, "R")).toEqual(allTime(40));
		expect(pickPriceStats({ R: { average: 40, salesCount: 3, latestPrice: 38 } }, "R")).toEqual(allTime(40, 3, 38));
	});

	it("falls back to the only known rarity", () => {
		expect(pickPriceStats({ R: allTime(40) }, "SR")?.value).toBe(40);
	});

	it("returns null when several other rarities exist", () => {
		expect(pickPriceStats({ R: allTime(40), UR: allTime(300) }, "SR")).toBeNull();
	});
});
