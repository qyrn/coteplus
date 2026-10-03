import { isRecord } from "../../lib/json";

export const REGULAR_REGEN_PERIOD_MS = 10 * 60 * 1000;
export const PRO_REGEN_PERIOD_MS = 3 * 60 * 1000;

export interface PackStockReading {
	stock: number;
	maxStock: number;
	nextPackInMs: number | null;
	isPro: boolean;
}

export interface PackStockState {
	stock: number;
	maxStock: number;
	nextPackAt: number | null;
	periodMs: number;
	readAt: number;
}

const STOCK_LABEL = "paquets disponibles";
const PRO_DAILY_PACK_LABEL = "Pack PRO du jour";
const STOCK_PATTERN = /(\d+)\s*\/\s*(\d+)/;
const COUNTDOWN_PATTERN = /Prochain dans\s*(?:(\d+):)?(\d{1,2}):(\d{2})/;

export function findStockBlock(root: ParentNode): HTMLElement | null {
	for (const element of root.querySelectorAll<HTMLElement>("main div")) {
		const ownText = [...element.childNodes]
			.filter((node) => node.nodeType === Node.TEXT_NODE)
			.map((node) => node.textContent ?? "")
			.join("");
		if (ownText.includes(STOCK_LABEL)) return element.parentElement;
	}
	return null;
}

function readCountdownMs(text: string): number | null {
	const match = COUNTDOWN_PATTERN.exec(text);
	if (!match) return null;
	const [, hours = "0", minutes = "0", seconds = "0"] = match;
	return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
}

export function readPackStock(root: ParentNode): PackStockReading | null {
	const block = findStockBlock(root);
	const text = block?.textContent ?? "";
	const stockMatch = STOCK_PATTERN.exec(text);
	if (!stockMatch) return null;
	const stock = Number(stockMatch[1]);
	const maxStock = Number(stockMatch[2]);
	if (!Number.isInteger(stock) || !Number.isInteger(maxStock) || maxStock <= 0) return null;
	const nextPackInMs = readCountdownMs(text);
	return {
		stock,
		maxStock,
		nextPackInMs,
		isPro: (root.querySelector("main")?.textContent ?? "").includes(PRO_DAILY_PACK_LABEL),
	};
}

export function stateFromReading(reading: PackStockReading, readAt: number): PackStockState {
	const periodMs = reading.isPro ? PRO_REGEN_PERIOD_MS : REGULAR_REGEN_PERIOD_MS;
	return {
		stock: Math.min(reading.stock, reading.maxStock),
		maxStock: reading.maxStock,
		nextPackAt:
			reading.stock >= reading.maxStock || reading.nextPackInMs === null ? null : readAt + reading.nextPackInMs,
		periodMs,
		readAt,
	};
}

export function estimateStock(state: PackStockState, now: number): number {
	if (state.nextPackAt === null || now < state.nextPackAt) return state.stock;
	const regenerated = 1 + Math.floor((now - state.nextPackAt) / state.periodMs);
	return Math.min(state.maxStock, state.stock + regenerated);
}

export function fullStockAt(state: PackStockState): number | null {
	if (state.stock >= state.maxStock || state.nextPackAt === null) return null;
	return state.nextPackAt + (state.maxStock - state.stock - 1) * state.periodMs;
}

export function nextStockChangeAt(state: PackStockState, now: number): number | null {
	if (state.nextPackAt === null || estimateStock(state, now) >= state.maxStock) return null;
	if (now < state.nextPackAt) return state.nextPackAt;
	const elapsedPeriods = Math.floor((now - state.nextPackAt) / state.periodMs) + 1;
	return state.nextPackAt + elapsedPeriods * state.periodMs;
}

export function isPackStockState(value: unknown): value is PackStockState {
	return (
		isRecord(value) &&
		typeof value.stock === "number" &&
		typeof value.maxStock === "number" &&
		(value.nextPackAt === null || typeof value.nextPackAt === "number") &&
		typeof value.periodMs === "number" &&
		value.periodMs > 0 &&
		typeof value.readAt === "number"
	);
}
