import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isQuietTime, readSettings } from "./settings";

function at(hours: number, minutes = 0): Date {
	return new Date(2026, 9, 3, hours, minutes);
}

describe("readSettings", () => {
	it("falls back to defaults for missing or broken values", () => {
		expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(readSettings({ greatDealPercent: "fort", wishlistRedirect: 1 })).toEqual(DEFAULT_SETTINGS);
	});

	it("clamps numbers to their range", () => {
		const settings = readSettings({
			greatDealPercent: 300,
			reminderLeadMinutes: 0,
			discardGuardMinPrice: 12.6,
			autoTagForSaleMinCote: 0,
			autoTagDiscardMaxCote: 2_000_000,
		});
		expect(settings.greatDealPercent).toBe(90);
		expect(settings.reminderLeadMinutes).toBe(1);
		expect(settings.discardGuardMinPrice).toBe(13);
		expect(settings.autoTagForSaleMinCote).toBe(1);
		expect(settings.autoTagDiscardMaxCote).toBe(1_000_000);
	});
});

describe("isQuietTime", () => {
	const overnight = { enabled: true, startMinute: 23 * 60, endMinute: 8 * 60 };

	it("handles a range crossing midnight", () => {
		expect(isQuietTime(overnight, at(23, 30))).toBe(true);
		expect(isQuietTime(overnight, at(7, 59))).toBe(true);
		expect(isQuietTime(overnight, at(8))).toBe(false);
		expect(isQuietTime(overnight, at(14))).toBe(false);
	});

	it("handles a range within the day", () => {
		const afternoon = { enabled: true, startMinute: 13 * 60, endMinute: 14 * 60 };
		expect(isQuietTime(afternoon, at(13, 30))).toBe(true);
		expect(isQuietTime(afternoon, at(14))).toBe(false);
	});

	it("stays off when disabled", () => {
		expect(isQuietTime({ ...overnight, enabled: false }, at(23, 30))).toBe(false);
	});
});
