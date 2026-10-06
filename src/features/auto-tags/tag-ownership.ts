import { AUTO_TAGS, type TagSpec } from "./auto-tag-rules";

export interface ExistingTag {
	id: string;
	name: string;
	color: string;
}

export function tagKey(name: string): string {
	return name.trim().toLocaleLowerCase("fr");
}

export function isExtensionTag(tag: ExistingTag, spec: TagSpec): boolean {
	return tagKey(tag.name) === tagKey(spec.name) && tag.color.toLowerCase() === spec.color;
}

export function extensionTags(existingTags: readonly ExistingTag[]): ExistingTag[] {
	return existingTags.filter((tag) => AUTO_TAGS.some((spec) => isExtensionTag(tag, spec)));
}
