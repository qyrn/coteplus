import { describe, expect, it } from "vitest";
import {
	estimateStock,
	fullStockAt,
	nextStockChangeAt,
	type PackStockState,
	PRO_REGEN_PERIOD_MS,
	REGULAR_REGEN_PERIOD_MS,
	readPackStock,
	stateFromReading,
} from "./pack-stock";

const MINUTE = 60 * 1000;

function pullsMarkup(stock: string, countdown: string | null, extra = ""): string {
	const countdownBlock = countdown
		? `<div class="text-xs">Prochain dans<span class="font-mono">${countdown}</span></div>`
		: "";
	return `<main><div><div class="text-center"><div class="text-lg"><span>${stock}</span><span>/ 10</span></div><div class="text-xs">paquets disponibles</div>${countdownBlock}</div></div>${extra}</main>`;
}

describe("readPackStock", () => {
	it("reads stock, max and countdown", () => {
		document.body.innerHTML = pullsMarkup("9", "5:03");
		expect(readPackStock(document)).toEqual({ stock: 9, maxStock: 10, nextPackInMs: 303_000, isPro: false });
	});

	it("detects Pro from the daily Pro pack block", () => {
		document.body.innerHTML = pullsMarkup("4", "2:10", "<section><h2>Pack PRO du jour</h2></section>");
		expect(readPackStock(document)?.isPro).toBe(true);
	});

	it("leaves Pro unknown when the countdown is short and no Pro block exists", () => {
		document.body.innerHTML = pullsMarkup("4", "2:10");
		expect(readPackStock(document)?.isPro).toBeNull();
	});

	it("handles a full stock without countdown", () => {
		document.body.innerHTML = pullsMarkup("10", null);
		expect(readPackStock(document)).toEqual({ stock: 10, maxStock: 10, nextPackInMs: null, isPro: null });
	});

	it("returns null outside the pulls screen", () => {
		document.body.innerHTML = "<main><div>Collection</div></main>";
		expect(readPackStock(document)).toBeNull();
	});
});

describe("stock estimation", () => {
	const state: PackStockState = {
		stock: 7,
		maxStock: 10,
		nextPackAt: 1_000_000,
		periodMs: REGULAR_REGEN_PERIOD_MS,
		readAt: 900_000,
	};

	it("keeps the read stock before the next pack", () => {
		expect(estimateStock(state, 999_999)).toBe(7);
	});

	it("adds one pack per elapsed period", () => {
		expect(estimateStock(state, 1_000_000)).toBe(8);
		expect(estimateStock(state, 1_000_000 + 10 * MINUTE)).toBe(9);
	});

	it("never exceeds the max stock", () => {
		expect(estimateStock(state, 1_000_000 + 100 * MINUTE)).toBe(10);
	});

	it("computes when the stock becomes full", () => {
		expect(fullStockAt(state)).toBe(1_000_000 + 2 * REGULAR_REGEN_PERIOD_MS);
		expect(fullStockAt({ ...state, stock: 10, nextPackAt: null })).toBeNull();
	});

	it("computes the next stock change", () => {
		expect(nextStockChangeAt(state, 950_000)).toBe(1_000_000);
		expect(nextStockChangeAt(state, 1_000_001)).toBe(1_000_000 + REGULAR_REGEN_PERIOD_MS);
		expect(nextStockChangeAt(state, 1_000_000 + 100 * MINUTE)).toBeNull();
	});
});

describe("stateFromReading", () => {
	it("anchors the next pack on the read time", () => {
		const reading = { stock: 4, maxStock: 10, nextPackInMs: 60_000, isPro: true };
		expect(stateFromReading(reading, 5_000, null)).toEqual({
			stock: 4,
			maxStock: 10,
			nextPackAt: 65_000,
			periodMs: PRO_REGEN_PERIOD_MS,
			readAt: 5_000,
		});
	});

	it("keeps the previous period when Pro is unknown", () => {
		const previous: PackStockState = {
			stock: 1,
			maxStock: 10,
			nextPackAt: null,
			periodMs: PRO_REGEN_PERIOD_MS,
			readAt: 0,
		};
		const reading = { stock: 2, maxStock: 10, nextPackInMs: 30_000, isPro: null };
		expect(stateFromReading(reading, 1_000, previous).periodMs).toBe(PRO_REGEN_PERIOD_MS);
	});
});
