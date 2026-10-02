import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { RARITIES, type Rarity } from "../../lib/site/rarity";

export type RarityCounts = Record<Rarity, number>;

export interface PullStats {
	counts: RarityCounts;
	legacyImported: boolean;
}

const KZFAMILY_PULL_STATS_KEY = "wm_pull_stats_v1";

export function emptyCounts(): RarityCounts {
	return { C: 0, PC: 0, R: 0, SR: 0, UR: 0, L: 0 };
}

export const pullStatsItem = storage.defineItem<PullStats>("local:pull-stats", {
	fallback: { counts: emptyCounts(), legacyImported: false },
});

export function totalCards(counts: RarityCounts): number {
	return RARITIES.reduce((sum, rarity) => sum + counts[rarity], 0);
}

export function addPulledRarity(stats: PullStats, rarity: Rarity): PullStats {
	return { ...stats, counts: { ...stats.counts, [rarity]: stats.counts[rarity] + 1 } };
}

export function parseLegacyCounts(raw: string | null): RarityCounts | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || !isRecord(parsed.counts)) return null;
	const counts = emptyCounts();
	for (const rarity of RARITIES) {
		const value = Number(parsed.counts[rarity]);
		counts[rarity] = Number.isInteger(value) && value > 0 ? value : 0;
	}
	return totalCards(counts) > 0 ? counts : null;
}

export async function importLegacyPullStatsOnce(readSiteStorage: (key: string) => string | null): Promise<void> {
	const stats = await pullStatsItem.getValue();
	if (stats.legacyImported) return;
	const legacy = parseLegacyCounts(readSiteStorage(KZFAMILY_PULL_STATS_KEY));
	const counts = emptyCounts();
	for (const rarity of RARITIES) counts[rarity] = stats.counts[rarity] + (legacy?.[rarity] ?? 0);
	await pullStatsItem.setValue({ counts, legacyImported: true });
}
