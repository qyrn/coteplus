import { type CardView, findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";

const REVEAL_POSITION_PATTERN = /Carte\s*(\d+)\s*\/\s*(\d+)/;
const FLIP_CONTAINER_SELECTOR = '[class*="animate-card-flip"]';

export interface RevealPosition {
	index: number;
	total: number;
	header: HTMLElement;
}

export type RevealEvent =
	| { type: "card-revealed"; card: CardView; position: RevealPosition }
	| { type: "reveal-ended" };

export interface RevealWatcher {
	subscribe(listener: (event: RevealEvent) => void): void;
}

export function readRevealPosition(root: ParentNode): RevealPosition | null {
	for (const span of root.querySelectorAll("main span")) {
		if (span.textContent?.trim() !== "Carte" || !span.parentElement) continue;
		const match = REVEAL_POSITION_PATTERN.exec(span.parentElement.textContent ?? "");
		if (!match) continue;
		const index = Number(match[1]);
		const total = Number(match[2]);
		if (index >= 1 && index <= total) return { index, total, header: span.parentElement };
	}
	return null;
}

function findRevealedCard(root: ParentNode): CardView | null {
	const flipContainer = root.querySelector(FLIP_CONTAINER_SELECTOR);
	return (flipContainer ? findCards(flipContainer)[0] : undefined) ?? findCards(root)[0] ?? null;
}

export function createRevealWatcher(pageWatcher: PageWatcher): RevealWatcher {
	const listeners: Array<(event: RevealEvent) => void> = [];
	let revealedPositions: Set<number> | null = null;

	function emit(event: RevealEvent): void {
		for (const listener of listeners) listener(event);
	}

	pageWatcher.subscribe(() => {
		const position = location.pathname === "/pulls" ? readRevealPosition(document) : null;
		if (!position) {
			if (revealedPositions) emit({ type: "reveal-ended" });
			revealedPositions = null;
			return;
		}
		revealedPositions ??= new Set();
		if (revealedPositions.has(position.index)) return;
		const card = findRevealedCard(document.querySelector("main") ?? document);
		if (!card) return;
		revealedPositions.add(position.index);
		emit({ type: "card-revealed", card, position });
	});

	return {
		subscribe(listener) {
			listeners.push(listener);
		},
	};
}
