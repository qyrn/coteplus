import type { AutoTagRule, CollectionCopy, TagSpec } from "./auto-tag-rules";

export interface ExistingTag {
	id: string;
	name: string;
}

export interface TagChange {
	tag: TagSpec;
	tagId: string | null;
	additions: string[];
	removals: string[];
}

function tagKey(name: string): string {
	return name.trim().toLocaleLowerCase("fr");
}

export function planAutoTags(
	copies: readonly CollectionCopy[],
	rules: readonly AutoTagRule[],
	existingTags: readonly ExistingTag[],
): TagChange[] {
	const existingByKey = new Map(existingTags.map((tag) => [tagKey(tag.name), tag.id]));
	return rules.flatMap((rule) => {
		const wantedByCopy = new Map(copies.map((copy) => [copy.userCardId, rule.wantedTags(copy)]));
		return rule.tags.flatMap((tag): TagChange[] => {
			const tagId = existingByKey.get(tagKey(tag.name)) ?? null;
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
			return additions.length > 0 || removals.length > 0 ? [{ tag, tagId, additions, removals }] : [];
		});
	});
}

export function countLinkChanges(changes: readonly TagChange[]): number {
	return changes.reduce((total, change) => total + change.additions.length + change.removals.length, 0);
}
