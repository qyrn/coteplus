import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import { isRecord } from "../json";

interface CacheEntry<TValue> {
	value: TValue;
	expiresAt: number;
}

export interface TtlStore<TValue> {
	get(id: string): Promise<TValue | null>;
	set(id: string, value: TValue, ttlMs: number): Promise<void>;
}

export function createTtlStore<TValue>(namespace: string): TtlStore<TValue> {
	const keyFor = (id: string) => `local:${namespace}:${id}` as const;
	return {
		async get(id) {
			const entry = await storage.getItem<CacheEntry<TValue>>(keyFor(id));
			if (!entry || entry.expiresAt <= Date.now()) return null;
			return entry.value;
		},
		async set(id, value, ttlMs) {
			await storage.setItem<CacheEntry<TValue>>(keyFor(id), {
				value,
				expiresAt: Date.now() + ttlMs,
			});
		},
	};
}

function isExpiredCacheEntry(value: unknown, now: number): boolean {
	return (
		isRecord(value) &&
		typeof value.expiresAt === "number" &&
		value.expiresAt <= now
	);
}

export async function purgeExpiredEntries(
	namespaces: readonly string[],
	now = Date.now(),
): Promise<void> {
	const everything = await browser.storage.local.get(null);
	const expiredKeys = Object.entries(everything)
		.filter(
			([key, value]) =>
				namespaces.some((namespace) => key.startsWith(`${namespace}:`)) &&
				isExpiredCacheEntry(value, now),
		)
		.map(([key]) => key);
	if (expiredKeys.length > 0) await browser.storage.local.remove(expiredKeys);
}
