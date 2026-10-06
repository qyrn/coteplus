import {
	ACTIVE_AUTO_TAGS,
	type AutoTagRule,
	type CollectionCopy,
	RETIRED_AUTO_TAGS,
	type TagSpec,
} from "./auto-tag-rules";
import { type ExistingTag, extensionTags, isExtensionTag, tagKey } from "./tag-ownership";

export interface TagChange {
	tag: TagSpec;
	tagId: string | null;
	additions: string[];
}

export interface AutoTagPlan {
	changes: TagChange[];
	userOwnedTags: TagSpec[];
	retiredTags: ExistingTag[];
	freshCopyCount: number;
}

function tagIdSet(tags: readonly ExistingTag[]): Set<string> {
	return new Set(tags.map((tag) => tag.id));
}

function freshCopiesOf(copies: readonly CollectionCopy[], existingTags: readonly ExistingTag[]): CollectionCopy[] {
	const activeIds = tagIdSet(extensionTags(existingTags, ACTIVE_AUTO_TAGS));
	const retiredIds = tagIdSet(extensionTags(existingTags, RETIRED_AUTO_TAGS));
	return copies.filter(
		(copy) => copy.tagIds.some((id) => retiredIds.has(id)) || !copy.tagIds.some((id) => activeIds.has(id)),
	);
}

export function planAutoTags(
	copies: readonly CollectionCopy[],
	rules: readonly AutoTagRule[],
	existingTags: readonly ExistingTag[],
): AutoTagPlan {
	const existingByKey = new Map(existingTags.map((tag) => [tagKey(tag.name), tag]));
	const freshCopies = freshCopiesOf(copies, existingTags);
	const plan: AutoTagPlan = {
		changes: [],
		userOwnedTags: [],
		retiredTags: extensionTags(existingTags, RETIRED_AUTO_TAGS),
		freshCopyCount: freshCopies.length,
	};
	for (const rule of rules) {
		const wantedByCopy = new Map(freshCopies.map((copy) => [copy.userCardId, rule.wantedTags(copy)]));
		for (const tag of rule.tags) {
			const existing = existingByKey.get(tagKey(tag.name));
			if (existing && !isExtensionTag(existing, tag)) {
				plan.userOwnedTags.push(tag);
				continue;
			}
			const tagId = existing?.id ?? null;
			const additions = freshCopies
				.filter((copy) => wantedByCopy.get(copy.userCardId)?.includes(tag.name))
				.filter((copy) => tagId === null || !copy.tagIds.includes(tagId))
				.map((copy) => copy.userCardId);
			if (additions.length > 0) plan.changes.push({ tag, tagId, additions });
		}
	}
	return plan;
}

export function countLinkChanges(changes: readonly TagChange[]): number {
	return changes.reduce((total, change) => total + change.additions.length, 0);
}
