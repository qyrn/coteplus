import { addPulledRarity, pullStatsItem } from "./pull-stats";
import type { RevealWatcher } from "./reveal-watcher";

export function startPullRevealTracker(revealWatcher: RevealWatcher): void {
	let recording = Promise.resolve();
	revealWatcher.subscribe((event) => {
		if (event.type !== "card-revealed") return;
		recording = recording.then(async () => {
			await pullStatsItem.setValue(addPulledRarity(await pullStatsItem.getValue(), event.card.rarity));
		});
	});
}
