import { isRecord } from "../../lib/json";
import { isRarity, type Rarity } from "../../lib/site/rarity";

export interface WishTarget {
	title: string;
	rarity: Rarity;
}

const WISH_TARGET_KEY = "wmp-wish-target";

export function saveWishTarget(target: WishTarget): void {
	sessionStorage.setItem(WISH_TARGET_KEY, JSON.stringify(target));
}

export function takeWishTarget(): WishTarget | null {
	const raw = sessionStorage.getItem(WISH_TARGET_KEY);
	sessionStorage.removeItem(WISH_TARGET_KEY);
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || typeof parsed.title !== "string" || typeof parsed.rarity !== "string") return null;
		return isRarity(parsed.rarity) ? { title: parsed.title, rarity: parsed.rarity } : null;
	} catch {
		return null;
	}
}
