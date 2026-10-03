import { createButton } from "../../lib/ui/button";
import { icon } from "../../lib/ui/icons";

export const LOCKED_NOTICE_CLASS = "wmp-lock-notice";

export function lockedNoticeContent(action: string, onUnlock: () => void): HTMLElement[] {
	const title = document.createElement("p");
	title.className = "wmp-lock-notice-title";
	title.append(icon("lock"), "Carte verrouillée");
	const text = document.createElement("p");
	text.className = "wmp-note";
	text.textContent = `Tu l'as verrouillée dans Cote+ pour ne pas ${action} par erreur.`;
	const unlock = createButton("Déverrouiller", "ghost", "lockOpen");
	unlock.addEventListener("click", onUnlock);
	return [title, text, unlock];
}
