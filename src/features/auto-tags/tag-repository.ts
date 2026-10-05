import { isRecord } from "../../lib/json";
import type { SupabaseRest } from "../../lib/net/supabase-rest";
import { isRarity } from "../../lib/site/rarity";
import type { ExistingTag, TagChange } from "./auto-tag-plan";
import type { CollectionCopy } from "./auto-tag-rules";

export interface TagSnapshot {
	copies: CollectionCopy[];
	tags: ExistingTag[];
}

const INSERT_CHUNK_SIZE = 500;
const DELETE_CHUNK_SIZE = 100;
const LINK_CONFLICT_COLUMNS = "user_card_id,tag_id";

function readTagIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((link) => (isRecord(link) && typeof link.tag_id === "string" ? [link.tag_id] : []));
}

function readCopy(row: unknown): CollectionCopy | null {
	if (!isRecord(row) || !isRecord(row.card)) return null;
	const { id, card_id: cardId } = row;
	const { rarity, category } = row.card;
	if (typeof id !== "string" || typeof cardId !== "string" || typeof rarity !== "string" || !isRarity(rarity)) {
		return null;
	}
	return {
		userCardId: id,
		cardId,
		rarity,
		category: typeof category === "string" ? category : "",
		starred: row.starred === true,
		tagIds: readTagIds(row.user_card_tags),
	};
}

function readTag(row: unknown): ExistingTag | null {
	if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") return null;
	return { id: row.id, name: row.name };
}

export async function loadTagSnapshot(rest: SupabaseRest): Promise<TagSnapshot> {
	const owner = `user_id=eq.${encodeURIComponent(rest.userId)}`;
	const [copyRows, tagRows] = await Promise.all([
		rest.getAll(
			`user_cards?select=id,card_id,starred,card:cards(rarity,category),user_card_tags(tag_id)&${owner}&order=id`,
		),
		rest.getAll(`tags?select=id,name&${owner}&order=name`),
	]);
	return {
		copies: copyRows.map(readCopy).filter((copy): copy is CollectionCopy => copy !== null),
		tags: tagRows.map(readTag).filter((tag): tag is ExistingTag => tag !== null),
	};
}

function chunk<TItem>(items: readonly TItem[], size: number): TItem[][] {
	return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
		items.slice(index * size, (index + 1) * size),
	);
}

async function createTag(rest: SupabaseRest, change: TagChange): Promise<string> {
	const [created] = await rest.insert("tags", [{ user_id: rest.userId, ...change.tag }], { returnRows: true });
	const tag = readTag(created);
	if (!tag) throw new Error(`Création de l'étiquette ${change.tag.name} impossible`);
	return tag.id;
}

export async function applyTagChanges(
	rest: SupabaseRest,
	changes: readonly TagChange[],
	onProgress: (doneLinks: number) => void,
): Promise<void> {
	let doneLinks = 0;
	for (const change of changes) {
		const tagId = change.tagId ?? (await createTag(rest, change));
		for (const userCardIds of chunk(change.additions, INSERT_CHUNK_SIZE)) {
			const links = userCardIds.map((userCardId) => ({ user_card_id: userCardId, tag_id: tagId }));
			await rest.insert("user_card_tags", links, { onConflict: LINK_CONFLICT_COLUMNS });
			doneLinks += userCardIds.length;
			onProgress(doneLinks);
		}
		for (const userCardIds of chunk(change.removals, DELETE_CHUNK_SIZE)) {
			await rest.remove(`user_card_tags?tag_id=eq.${tagId}&user_card_id=in.(${userCardIds.join(",")})`);
			doneLinks += userCardIds.length;
			onProgress(doneLinks);
		}
	}
}
