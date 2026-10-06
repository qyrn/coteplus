import type { TagSpec } from "./auto-tag-rules";

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

export function extensionTags(existingTags: readonly ExistingTag[], specs: readonly TagSpec[]): ExistingTag[] {
	return existingTags.filter((tag) => specs.some((spec) => isExtensionTag(tag, spec)));
}
