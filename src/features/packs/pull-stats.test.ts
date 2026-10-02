import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
	addPulledRarity,
	emptyCounts,
	importLegacyPullStatsOnce,
	parseLegacyCounts,
	pullStatsItem,
} from "./pull-stats";

describe("parseLegacyCounts", () => {
	it("reads kzfamily counts", () => {
		const raw = JSON.stringify({ counts: { L: 0, UR: 1, SR: 5, R: 33, PC: 61, C: 245 }, updatedAt: 1 });
		expect(parseLegacyCounts(raw)).toEqual({ C: 245, PC: 61, R: 33, SR: 5, UR: 1, L: 0 });
	});

	it("rejects invalid or empty data", () => {
		expect(parseLegacyCounts(null)).toBeNull();
		expect(parseLegacyCounts("{oops")).toBeNull();
		expect(parseLegacyCounts(JSON.stringify({ counts: { C: -3 } }))).toBeNull();
	});
});

describe("addPulledRarity", () => {
	it("increments one rarity", () => {
		const stats = addPulledRarity({ counts: emptyCounts(), legacyImported: true }, "SR");
		expect(stats.counts.SR).toBe(1);
		expect(stats.counts.C).toBe(0);
	});
});

describe("importLegacyPullStatsOnce", () => {
	beforeEach(() => fakeBrowser.reset());

	it("adds legacy counts a single time", async () => {
		const raw = JSON.stringify({ counts: { C: 10, L: 1 } });
		await importLegacyPullStatsOnce(() => raw);
		await importLegacyPullStatsOnce(() => raw);
		const stats = await pullStatsItem.getValue();
		expect(stats.counts.C).toBe(10);
		expect(stats.counts.L).toBe(1);
		expect(stats.legacyImported).toBe(true);
	});
});
