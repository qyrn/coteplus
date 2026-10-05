import type { Rarity } from "../../lib/site/rarity";
import { CATEGORY_GROUPS, categoryGroupOf } from "./category-groups";

export interface CollectionCopy {
	userCardId: string;
	cardId: string;
	rarity: Rarity;
	category: string;
	starred: boolean;
	tagIds: readonly string[];
}

export interface TagSpec {
	name: string;
	color: string;
}

export type AutoTagRuleId = "duplicates" | "forSale" | "category";

export interface AutoTagRule {
	id: AutoTagRuleId;
	tags: readonly TagSpec[];
	wantedTags(copy: CollectionCopy): readonly string[] | null;
}

export const AUTO_TAG_RULE_IDS: readonly AutoTagRuleId[] = ["duplicates", "forSale", "category"];

const DUPLICATE_TAG: TagSpec = { name: "Doublon", color: "#38bdf8" };
const FOR_SALE_TAG: TagSpec = { name: "À vendre", color: "#22c55e" };

function countCopiesByCard(copies: readonly CollectionCopy[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const copy of copies) counts.set(copy.cardId, (counts.get(copy.cardId) ?? 0) + 1);
	return counts;
}

export function createAutoTagRules(
	copies: readonly CollectionCopy[],
	coteOf: (copy: CollectionCopy) => number | null,
	forSaleMinCote: number,
): Record<AutoTagRuleId, AutoTagRule> {
	const copiesByCard = countCopiesByCard(copies);
	return {
		duplicates: {
			id: "duplicates",
			tags: [DUPLICATE_TAG],
			wantedTags: (copy) => ((copiesByCard.get(copy.cardId) ?? 0) > 1 ? [DUPLICATE_TAG.name] : []),
		},
		forSale: {
			id: "forSale",
			tags: [FOR_SALE_TAG],
			wantedTags: (copy) => {
				if (copy.starred) return [];
				const cote = coteOf(copy);
				if (cote === null) return null;
				return cote >= forSaleMinCote ? [FOR_SALE_TAG.name] : [];
			},
		},
		category: {
			id: "category",
			tags: CATEGORY_GROUPS.map(({ name, color }) => ({ name, color })),
			wantedTags: (copy) => {
				const group = categoryGroupOf(copy.category);
				return group ? [group.name] : [];
			},
		},
	};
}
