import { storage } from "wxt/utils/storage";

const LOCK_NAME = "cote-plus-site-requests";
const WINDOW_MS = 60 * 1000;

const requestLogItem = storage.defineItem<number[]>("local:site-request-log", { fallback: [] });

function wait(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function recentStarts(log: readonly number[], now: number): number[] {
	return log.filter((startedAt) => startedAt > now - WINDOW_MS && startedAt <= now).sort((left, right) => left - right);
}

export function delayBeforeSlot(recent: readonly number[], now: number, maxPerMinute: number): number {
	if (recent.length < maxPerMinute) return 0;
	const blocking = recent[recent.length - maxPerMinute] ?? now;
	return Math.max(0, blocking + WINDOW_MS - now);
}

export function createSharedRequestBudget(maxPerMinute: number): () => Promise<void> {
	return () =>
		navigator.locks.request(LOCK_NAME, async () => {
			for (;;) {
				const now = Date.now();
				const recent = recentStarts(await requestLogItem.getValue(), now);
				const delay = delayBeforeSlot(recent, now, maxPerMinute);
				if (delay === 0) {
					await requestLogItem.setValue([...recent, now]);
					return;
				}
				await wait(delay);
			}
		});
}
