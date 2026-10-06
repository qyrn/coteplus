import type { AutoTagRule, CollectionCopy, TagSpec } from "./auto-tag-rules";
import { type ExistingTag, isExtensionTag, tagKey } from "./tag-ownership";

export interface TagChange {
	tag: TagSpec;
	tagId: string | null;
	additions: string[];
	removals: string[];
}

export interface AutoTagPlan {
	changes: TagChange[];
	userOwnedTags: TagSpec[];
}

export function planAutoTags(
	copies: readonly CollectionCopy[],
	rules: readonly AutoTagRule[],
	existingTags: readonly ExistingTag[],
): AutoTagPlan {
	const existingByKey = new Map(existingTags.map((tag) => [tagKey(tag.name), tag]));
	const plan: AutoTagPlan = { changes: [], userOwnedTags: [] };
	for (const rule of rules) {
		const wantedByCopy = new Map(copies.map((copy) => [copy.userCardId, rule.wantedTags(copy)]));
		for (const tag of rule.tags) {
			const existing = existingByKey.get(tagKey(tag.name));
			if (existing && !isExtensionTag(existing, tag)) {
				plan.userOwnedTags.push(tag);
				continue;
			}
			const tagId = existing?.id ?? null;
			const additions: string[] = [];
			const removals: string[] = [];
			for (const copy of copies) {
				const wanted = wantedByCopy.get(copy.userCardId);
				if (!wanted) continue;
				const isTagged = tagId !== null && copy.tagIds.includes(tagId);
				const isWanted = wanted.includes(tag.name);
				if (isWanted && !isTagged) additions.push(copy.userCardId);
				if (!isWanted && isTagged) removals.push(copy.userCardId);
			}
			if (additions.length > 0 || removals.length > 0) plan.changes.push({ tag, tagId, additions, removals });
		}
	}
	return plan;
}

export function countLinkChanges(changes: readonly TagChange[]): number {
	return changes.reduce((total, change) => total + change.additions.length + change.removals.length, 0);
}
