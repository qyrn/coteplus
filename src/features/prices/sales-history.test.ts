import { describe, expect, it } from "vitest";
import { coteSheet, estimateCote, hasSalesHistory, parseSales, type Sale } from "./sales-history";

const HOUR = 60 * 60 * 1000;

function salesAt(prices: number[], rarity: Sale["rarity"] = "L"): Sale[] {
	return prices.map((price, index) => ({ price, rarity, settledAt: index * HOUR }));
}

describe("parseSales", () => {
	it("reads the sale list and ignores broken entries", () => {
		const json = {
			sales: [
				{ id: "a", final_price: 336, rarity: "L", settled_at: "2026-09-16T21:06:42.755804+00:00" },
				{ id: "b", final_price: "12", rarity: "L", settled_at: "2026-09-16T21:06:42Z" },
				{ id: "c", final_price: 40, rarity: "Z", settled_at: "2026-09-16T21:06:42Z" },
			],
		};
		expect(parseSales(json)).toEqual([
			{ price: 336, rarity: "L", settledAt: Date.parse("2026-09-16T21:06:42.755804+00:00") },
		]);
		expect(hasSalesHistory(json)).toBe(true);
		expect(hasSalesHistory({ summary: {} })).toBe(false);
	});

	it("falls back to the recent sales", () => {
		expect(parseSales({ recent: [{ final_price: 5, rarity: "C", settled_at: "2026-10-01T00:00:00Z" }] })).toHaveLength(
			1,
		);
	});
});

describe("estimateCote", () => {
	it("follows the recent prices instead of old expensive sales", () => {
		const sales = salesAt([900, 850, 800, 210, 200, 205, 195, 200, 210, 190]);
		const cote = estimateCote(sales, "L");
		expect(cote?.value).toBeGreaterThanOrEqual(195);
		expect(cote?.value).toBeLessThanOrEqual(210);
		expect(cote?.basis).toBe("recent");
		expect(cote?.latestPrice).toBe(190);
	});

	it("ignores an isolated extreme sale", () => {
		const cote = estimateCote(salesAt([100, 105, 98, 102, 30000, 101]), "L");
		expect(cote?.value).toBeLessThan(110);
		expect(cote?.high).toBeLessThan(110);
	});

	it("gives a range around the cote", () => {
		const cote = estimateCote(salesAt([100, 120, 140, 160, 180]), "L");
		expect(cote?.low).toBeLessThanOrEqual(cote?.value ?? 0);
		expect(cote?.high).toBeGreaterThanOrEqual(cote?.value ?? 0);
	});

	it("skips the range with too few sales", () => {
		expect(estimateCote(salesAt([100, 120]), "L")).toMatchObject({ low: null, high: null, salesCount: 2 });
		expect(estimateCote(salesAt([100]), "SR")).toBeNull();
	});
});

describe("coteSheet", () => {
	it("computes one cote per rarity", () => {
		const sheet = coteSheet([...salesAt([10, 12, 11], "C"), ...salesAt([400, 420, 410], "UR")]);
		expect(Object.keys(sheet).sort()).toEqual(["C", "UR"]);
	});
});
