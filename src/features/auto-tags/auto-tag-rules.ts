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

export type AutoTagRuleId = "duplicates" | "forSale" | "discard" | "category";

export interface AutoTagRule {
	id: AutoTagRuleId;
	tags: readonly TagSpec[];
	wantedTags(copy: CollectionCopy): readonly string[];
}

export interface CoteThresholds {
	forSaleMinCote: number;
	discardMaxCote: number;
}

export const AUTO_TAG_RULE_IDS: readonly AutoTagRuleId[] = ["duplicates", "forSale", "discard", "category"];

export const COTE_RULE_IDS: readonly AutoTagRuleId[] = ["forSale", "discard"];

const DUPLICATE_TAG: TagSpec = { name: "Doublon", color: "#38bdf8" };
const FOR_SALE_TAG: TagSpec = { name: "À vendre", color: "#22c55e" };
const DISCARD_TAG: TagSpec = { name: "À défausser", color: "#f87171" };
const MISC_TAG: TagSpec = { name: "Divers", color: "#a1a1aa" };
const CATEGORY_TAGS: readonly TagSpec[] = [...CATEGORY_GROUPS.map(({ name, color }) => ({ name, color })), MISC_TAG];

export const ACTIVE_AUTO_TAGS: readonly TagSpec[] = [DUPLICATE_TAG, FOR_SALE_TAG, DISCARD_TAG, ...CATEGORY_TAGS];

export const RETIRED_AUTO_TAGS: readonly TagSpec[] = [
	{ name: "Personnes", color: "#f472b6" },
	{ name: "Sport", color: "#fb923c" },
	{ name: "Œuvres", color: "#c084fc" },
	{ name: "Lieux", color: "#facc15" },
	{ name: "Nature", color: "#4ade80" },
];

export const AUTO_TAGS: readonly TagSpec[] = [...ACTIVE_AUTO_TAGS, ...RETIRED_AUTO_TAGS];

function countCopiesByCard(copies: readonly CollectionCopy[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const copy of copies) counts.set(copy.cardId, (counts.get(copy.cardId) ?? 0) + 1);
	return counts;
}

function coteRule(
	id: AutoTagRuleId,
	tag: TagSpec,
	coteOf: (copy: CollectionCopy) => number | null,
	matches: (cote: number) => boolean,
): AutoTagRule {
	return {
		id,
		tags: [tag],
		wantedTags: (copy) => {
			if (copy.starred) return [];
			const cote = coteOf(copy);
			return cote !== null && matches(cote) ? [tag.name] : [];
		},
	};
}

export function createAutoTagRules(
	copies: readonly CollectionCopy[],
	coteOf: (copy: CollectionCopy) => number | null,
	{ forSaleMinCote, discardMaxCote }: CoteThresholds,
): Record<AutoTagRuleId, AutoTagRule> {
	const copiesByCard = countCopiesByCard(copies);
	return {
		duplicates: {
			id: "duplicates",
			tags: [DUPLICATE_TAG],
			wantedTags: (copy) => ((copiesByCard.get(copy.cardId) ?? 0) > 1 ? [DUPLICATE_TAG.name] : []),
		},
		forSale: coteRule("forSale", FOR_SALE_TAG, coteOf, (cote) => cote >= forSaleMinCote),
		discard: coteRule("discard", DISCARD_TAG, coteOf, (cote) => cote < discardMaxCote),
		category: {
			id: "category",
			tags: CATEGORY_TAGS,
			wantedTags: (copy) => [categoryGroupOf(copy.category)?.name ?? MISC_TAG.name],
		},
	};
}
