import { isRecord } from "../../lib/json";
import { normalizeTitle } from "../../lib/site/card-dom";
import type { Rarity } from "../../lib/site/rarity";

interface CatalogCard {
	id: string;
	title: string;
	rarity: string;
}

function readCatalogCard(entry: unknown): CatalogCard | null {
	const card = isRecord(entry) && isRecord(entry.card) ? entry.card : entry;
	if (!isRecord(card)) return null;
	const { id, wikipedia_title: title, rarity } = card;
	if (
		typeof id !== "string" ||
		typeof title !== "string" ||
		typeof rarity !== "string"
	)
		return null;
	return { id, title: normalizeTitle(title), rarity };
}

export function findCardIdInSearch(
	json: unknown,
	title: string,
	rarity: Rarity,
): string | null {
	const entries = isRecord(json) && Array.isArray(json.cards) ? json.cards : [];
	const matches = entries
		.map(readCatalogCard)
		.filter(
			(card): card is CatalogCard => card !== null && card.title === title,
		);
	const sameRarity = matches.find((card) => card.rarity === rarity);
	return (sameRarity ?? matches[0])?.id ?? null;
}

export function catalogSearchUrl(title: string): string {
	const params = new URLSearchParams({ page: "0", q: title, sort: "rarity" });
	return `/api/cards?${params.toString()}`;
}
