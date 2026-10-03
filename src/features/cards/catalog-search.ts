import { isRecord } from "../../lib/json";
import { normalizeTitle } from "../../lib/site/card-dom";
import { isRarity, type Rarity } from "../../lib/site/rarity";
import { type CardRef, readHideImage, type TitledCardRef } from "./card-ref";

interface CatalogCard extends CardRef {
	title: string;
	rarity: string;
}

function readCatalogCard(entry: unknown): CatalogCard | null {
	const card = isRecord(entry) && isRecord(entry.card) ? entry.card : entry;
	if (!isRecord(card)) return null;
	const { id, wikipedia_title: title, rarity } = card;
	if (typeof id !== "string" || typeof title !== "string" || typeof rarity !== "string") return null;
	return { cardId: id, hideImage: readHideImage(card), title: normalizeTitle(title), rarity };
}

function readCatalogCards(json: unknown): CatalogCard[] {
	const entries = isRecord(json) && Array.isArray(json.cards) ? json.cards : [];
	return entries.map(readCatalogCard).filter((card): card is CatalogCard => card !== null);
}

export function readSearchCards(json: unknown): TitledCardRef[] {
	return readCatalogCards(json).flatMap(({ cardId, hideImage, title, rarity }) =>
		isRarity(rarity) ? [{ cardId, hideImage, title, rarity }] : [],
	);
}

export function findCardInSearch(json: unknown, title: string, rarity: Rarity): CardRef | null {
	const matches = readCatalogCards(json).filter((card) => card.title === title);
	const match = matches.find((card) => card.rarity === rarity) ?? matches[0];
	return match ? { cardId: match.cardId, hideImage: match.hideImage } : null;
}

export function catalogSearchUrl(title: string): string {
	const params = new URLSearchParams({ page: "0", q: title, sort: "rarity" });
	return `/api/cards?${params.toString()}`;
}
