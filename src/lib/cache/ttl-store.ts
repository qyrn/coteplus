import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import { isRecord } from "../json";

interface CacheEntry<TValue> {
	value: TValue;
	storedAt: number;
	expiresAt: number;
}

export interface CachedValue<TValue> {
	value: TValue;
	storedAt: number;
}

export interface TtlStore<TValue> {
	get(id: string): Promise<CachedValue<TValue> | null>;
	set(id: string, value: TValue, ttlMs: number): Promise<void>;
	setMany(
		entries: ReadonlyArray<readonly [string, TValue]>,
		ttlMs: number,
	): Promise<void>;
}

export function createTtlStore<TValue>(namespace: string): TtlStore<TValue> {
	const keyFor = (id: string) => `local:${namespace}:${id}` as const;
	const memory = new Map<string, CacheEntry<TValue>>();

	function remember(
		id: string,
		value: TValue,
		ttlMs: number,
	): CacheEntry<TValue> {
		const storedAt = Date.now();
		const entry = { value, storedAt, expiresAt: storedAt + ttlMs };
		memory.set(id, entry);
		return entry;
	}

	return {
		async get(id) {
			const entry =
				memory.get(id) ??
				(await storage.getItem<CacheEntry<TValue>>(keyFor(id)));
			if (!entry || entry.expiresAt <= Date.now()) return null;
			memory.set(id, entry);
			return { value: entry.value, storedAt: entry.storedAt };
		},
		async set(id, value, ttlMs) {
			await storage.setItem(keyFor(id), remember(id, value, ttlMs));
		},
		async setMany(entries, ttlMs) {
			await storage.setItems(
				entries.map(([id, value]) => ({
					key: keyFor(id),
					value: remember(id, value, ttlMs),
				})),
			);
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
