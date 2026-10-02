import { describe, expect, it } from "vitest";
import { timeUntil } from "./relative-time";

const MINUTE = 60 * 1000;

describe("timeUntil", () => {
	it("formats the remaining time in French", () => {
		expect(timeUntil(30_000, 0)).toBe("dans moins d'1 min");
		expect(timeUntil(12 * MINUTE, 0)).toBe("dans 12 min");
		expect(timeUntil(65 * MINUTE, 0)).toBe("dans 1 h 05");
		expect(timeUntil(26 * 60 * MINUTE, 0)).toBe("dans 1 j 2 h");
	});

	it("says when the time is over", () => {
		expect(timeUntil(0, 10)).toBe("terminée");
	});
});
