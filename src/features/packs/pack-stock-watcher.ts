import type { PageWatcher } from "../../lib/site/page-watcher";
import { type PackStockReading, readPackStock, stateFromReading } from "./pack-stock";
import { packStockItem } from "./pack-stock-store";

const SIGNED_OUT_ROUTES = new Set(["/login", "/signup"]);
const COUNTDOWN_DRIFT_TOLERANCE_MS = 2000;

interface SavedReading {
	reading: PackStockReading;
	nextPackAt: number | null;
}

function isSameReading(previous: SavedReading | null, reading: PackStockReading, nextPackAt: number | null): boolean {
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

export function startPackStockWatcher(pageWatcher: PageWatcher): void {
	let lastSaved: SavedReading | null = null;
	let signedOutSaved = false;

	pageWatcher.subscribe(() => {
		if (SIGNED_OUT_ROUTES.has(location.pathname)) {
			lastSaved = null;
			if (signedOutSaved) return;
			signedOutSaved = true;
			packStockItem.setValue(null).catch(() => {
				signedOutSaved = false;
			});
			return;
		}
		signedOutSaved = false;
		if (location.pathname !== "/pulls") return;
		const reading = readPackStock(document);
		if (!reading) return;
		const readAt = Date.now();
		const nextPackAt = reading.nextPackInMs === null ? null : readAt + reading.nextPackInMs;
		if (isSameReading(lastSaved, reading, nextPackAt)) return;
		const saved = { reading, nextPackAt };
		lastSaved = saved;
		packStockItem.setValue(stateFromReading(reading, readAt)).catch((error: unknown) => {
			if (lastSaved === saved) lastSaved = null;
			console.error("[Cote+]", error);
		});
	});
}
