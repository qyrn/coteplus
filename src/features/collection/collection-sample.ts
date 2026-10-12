import type { Rarity } from "../../lib/site/rarity";
import type { OwnedCard } from "../cards/collection-index";

export const EXACT_RARITIES: readonly Rarity[] = ["L", "UR"];
export const SAMPLE_SIZE_PER_RARITY = 40;

function stableHash(text: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export function isExactRarity(rarity: Rarity): boolean {
	return EXACT_RARITIES.includes(rarity);
}

export function sampledCardIds(owned: readonly OwnedCard[]): Set<string> {
	const byRarity = new Map<Rarity, OwnedCard[]>();
	for (const card of owned) {
		if (isExactRarity(card.rarity)) continue;
		byRarity.set(card.rarity, [...(byRarity.get(card.rarity) ?? []), card]);
	}
	const sampled = new Set<string>();
	for (const cards of byRarity.values()) {
		const shuffled = [...cards].sort((left, right) => stableHash(left.cardId) - stableHash(right.cardId));
		for (const card of shuffled.slice(0, SAMPLE_SIZE_PER_RARITY)) sampled.add(card.cardId);
	}
	return sampled;
}
