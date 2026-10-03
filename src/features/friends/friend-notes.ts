import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";

export const NOTE_MAX_LENGTH = 500;

export const friendNotesItem = storage.defineItem<unknown>("local:friend-notes", { fallback: {} });

export function readFriendNotes(value: unknown): Record<string, string> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""),
	);
}

export function withNote(notes: Record<string, string>, username: string, note: string): Record<string, string> {
	const { [username]: _previous, ...others } = notes;
	const trimmed = note.trim().slice(0, NOTE_MAX_LENGTH);
	return trimmed ? { ...others, [username]: trimmed } : others;
}

export function profileUsername(pathname: string): string | null {
	const match = /^\/profile\/([^/]+)$/.exec(pathname);
	if (!match?.[1]) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}
