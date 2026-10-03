import { describe, expect, it } from "vitest";
import { delayBeforeSlot, recentStarts } from "./shared-request-budget";

const SECOND = 1000;

describe("shared request budget", () => {
	it("forgets requests older than a minute", () => {
		expect(recentStarts([0, 30 * SECOND, 70 * SECOND], 80 * SECOND)).toEqual([30 * SECOND, 70 * SECOND]);
	});

	it("lets a request start while the minute budget is not used up", () => {
		expect(delayBeforeSlot([10 * SECOND], 20 * SECOND, 2)).toBe(0);
	});

	it("waits until the oldest counted request leaves the window", () => {
		expect(delayBeforeSlot([10 * SECOND, 20 * SECOND], 30 * SECOND, 2)).toBe(40 * SECOND);
	});
});
