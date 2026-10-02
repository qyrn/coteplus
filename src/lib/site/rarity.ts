export const RARITIES = ["C", "PC", "R", "SR", "UR", "L"] as const;

export type Rarity = (typeof RARITIES)[number];

export function isRarity(value: string): value is Rarity {
	return (RARITIES as readonly string[]).includes(value);
}
