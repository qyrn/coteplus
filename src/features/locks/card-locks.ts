import { storage } from "wxt/utils/storage";
import type { Rarity } from "../../lib/site/rarity";

export const lockedCardsItem = storage.defineItem<string[]>("local:locked-cards", { fallback: [] });

export function lockKey(title: string, rarity: Rarity): string {
	return `${rarity}:${title}`;
}

export async function isLocked(title: string, rarity: Rarity): Promise<boolean> {
	return (await lockedCardsItem.getValue()).includes(lockKey(title, rarity));
}

export async function setLocked(title: string, rarity: Rarity, locked: boolean): Promise<void> {
	const key = lockKey(title, rarity);
	const current = (await lockedCardsItem.getValue()).filter((entry) => entry !== key);
	await lockedCardsItem.setValue(locked ? [...current, key] : current);
}
