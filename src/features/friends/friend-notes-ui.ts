import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { friendNotesItem, NOTE_MAX_LENGTH, profileUsername, readFriendNotes, withNote } from "./friend-notes";

const SAVE_DELAY_MS = 400;
const FRIENDS_PATH = "/friends";
const NOTE_PREVIEW_CLASS = "wmp-friend-note";

export function startFriendNotes(ctx: ContentScriptContext, pageWatcher: PageWatcher): void {
	let notes: Record<string, string> = {};
	let saveTimer: number | undefined;
	let editedUsername: string | null = null;

	const panel = document.createElement("section");
	panel.className = "wmp-panel wmp-note-panel";
	const label = document.createElement("label");
	label.className = "wmp-note-label";
	const title = document.createElement("span");
	title.className = "wmp-panel-title";
	const textarea = document.createElement("textarea");
	textarea.className = "wmp-note-input";
	textarea.maxLength = NOTE_MAX_LENGTH;
	textarea.rows = 2;
	textarea.placeholder = "Ce qu'il collectionne, ce qu'il cherche, vos échanges en cours…";
	label.append(title, textarea);
	const hint = document.createElement("p");
	hint.className = "wmp-note";
	hint.textContent = "Visible seulement par toi, enregistrée dans Cote+.";
	panel.append(label, hint);

	textarea.addEventListener("input", () => {
		const username = editedUsername;
		if (!username) return;
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => {
			void friendNotesItem.setValue(withNote(notes, username, textarea.value));
		}, SAVE_DELAY_MS);
	});

	function placeProfilePanel(username: string): void {
		const header = document.querySelector("main h1")?.closest<HTMLElement>(".card-frame");
		if (!header) return;
		if (panel.previousElementSibling !== header) header.insertAdjacentElement("afterend", panel);
		if (editedUsername !== username) {
			editedUsername = username;
			title.textContent = `Ta note sur ${username}`;
			textarea.value = notes[username] ?? "";
		}
	}

	function renderFriendPreviews(): void {
		for (const link of document.querySelectorAll<HTMLAnchorElement>('main a[href^="/profile/"]')) {
			const username = profileUsername(link.getAttribute("href") ?? "");
			const row = link.parentElement;
			if (!username || !row) continue;
			const preview = row.querySelector<HTMLElement>(`:scope > .${NOTE_PREVIEW_CLASS}`);
			const note = notes[username];
			if (!note) {
				preview?.remove();
				continue;
			}
			const element = preview ?? document.createElement("p");
			element.className = NOTE_PREVIEW_CLASS;
			element.title = note;
			if (element.textContent !== note) element.textContent = note;
			if (!element.isConnected) link.insertAdjacentElement("afterend", element);
		}
	}

	function render(): void {
		const username = profileUsername(location.pathname);
		if (username) placeProfilePanel(username);
		else {
			panel.remove();
			editedUsername = null;
		}
		if (location.pathname === FRIENDS_PATH) renderFriendPreviews();
	}

	function update(value: unknown): void {
		notes = readFriendNotes(value);
		if (document.activeElement !== textarea && editedUsername) textarea.value = notes[editedUsername] ?? "";
		render();
	}

	void friendNotesItem.getValue().then(update);
	ctx.onInvalidated(friendNotesItem.watch(update));
	pageWatcher.subscribe(render);
}
