import { browser } from "wxt/browser";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { PackStockMessage } from "./pack-messages";
import { type PackStockReading, readPackStock } from "./pack-stock";

const SIGNED_OUT_ROUTES = new Set(["/login", "/signup"]);
const COUNTDOWN_DRIFT_TOLERANCE_MS = 2000;

interface SentReading {
	reading: PackStockReading;
	nextPackAt: number | null;
}

function isSameReading(previous: SentReading | null, reading: PackStockReading, nextPackAt: number | null): boolean {
	if (!previous) return false;
	const sameCountdown =
		previous.nextPackAt === nextPackAt ||
		(previous.nextPackAt !== null &&
			nextPackAt !== null &&
			Math.abs(previous.nextPackAt - nextPackAt) <= COUNTDOWN_DRIFT_TOLERANCE_MS);
	return (
		sameCountdown &&
		previous.reading.stock === reading.stock &&
		previous.reading.maxStock === reading.maxStock &&
		previous.reading.isPro === reading.isPro
	);
}

function send(message: PackStockMessage): void {
	browser.runtime.sendMessage(message).catch(() => undefined);
}

export function startPackStockWatcher(pageWatcher: PageWatcher): void {
	let lastSent: SentReading | null = null;
	let signedOutSent = false;

	pageWatcher.subscribe(() => {
		if (SIGNED_OUT_ROUTES.has(location.pathname)) {
			if (!signedOutSent) send({ type: "pack-stock/signed-out" });
			signedOutSent = true;
			lastSent = null;
			return;
		}
		signedOutSent = false;
		if (location.pathname !== "/pulls") return;
		const reading = readPackStock(document);
		if (!reading) return;
		const readAt = Date.now();
		const nextPackAt = reading.nextPackInMs === null ? null : readAt + reading.nextPackInMs;
		if (isSameReading(lastSent, reading, nextPackAt)) return;
		lastSent = { reading, nextPackAt };
		send({ type: "pack-stock/read", reading, readAt });
	});
}
