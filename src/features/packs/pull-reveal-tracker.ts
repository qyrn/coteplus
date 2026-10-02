import { type CardView, findCards } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { addPulledRarity, pullStatsItem } from "./pull-stats";

const REVEAL_POSITION_PATTERN = /Carte\s*(\d+)\s*\/\s*(\d+)/;
const FLIP_CONTAINER_SELECTOR = '[class*="animate-card-flip"]';

export interface RevealPosition {
	index: number;
	total: number;
}

export function readRevealPosition(root: ParentNode): RevealPosition | null {
	for (const span of root.querySelectorAll("main span")) {
		if (span.textContent?.trim() !== "Carte") continue;
		const match = REVEAL_POSITION_PATTERN.exec(span.parentElement?.textContent ?? "");
		if (!match) continue;
		const index = Number(match[1]);
		const total = Number(match[2]);
		if (index >= 1 && index <= total) return { index, total };
	}
	return null;
}

function findRevealedCard(root: ParentNode): CardView | null {
	const flipContainer = root.querySelector(FLIP_CONTAINER_SELECTOR);
	return (flipContainer ? findCards(flipContainer)[0] : undefined) ?? findCards(root)[0] ?? null;
}

export function startPullRevealTracker(pageWatcher: PageWatcher): void {
	let countedPositions: Set<number> | null = null;
	let recording = Promise.resolve();

	pageWatcher.subscribe(() => {
		const position = location.pathname === "/pulls" ? readRevealPosition(document) : null;
		if (!position) {
			countedPositions = null;
			return;
		}
		countedPositions ??= new Set();
		if (countedPositions.has(position.index)) return;
		const card = findRevealedCard(document.querySelector("main") ?? document);
		if (!card) return;
		countedPositions.add(position.index);
		recording = recording.then(async () => {
			await pullStatsItem.setValue(addPulledRarity(await pullStatsItem.getValue(), card.rarity));
		});
	});
}
