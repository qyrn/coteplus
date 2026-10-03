import type { OwnedCard } from "../cards/collection-index";
import type { TradeCardChip } from "./trade-side";

export type ImpactTone = "good" | "warning" | "neutral";

export interface ImpactLine {
	text: string;
	tone: ImpactTone;
}

export function ownedByTitle(owned: readonly OwnedCard[]): Map<string, OwnedCard> {
	return new Map(owned.map((card) => [card.title, card]));
}

export function receivedImpact(cards: readonly TradeCardChip[], owned: ReadonlyMap<string, OwnedCard>): ImpactLine[] {
	if (cards.length === 0) return [];
	const newCards = cards.filter((card) => !owned.has(card.title)).length;
	if (newCards === 0) return [{ text: "Tu as déjà toutes ces cartes", tone: "neutral" }];
	return [{ text: `Nouvelles pour toi : ${newCards} sur ${cards.length}`, tone: "good" }];
}

export function givenImpact(cards: readonly TradeCardChip[], owned: ReadonlyMap<string, OwnedCard>): ImpactLine[] {
	if (cards.length === 0) return [];
	const lastCopies = cards.filter((card) => owned.get(card.title)?.copies === 1).map((card) => card.title);
	const starred = cards.filter((card) => (owned.get(card.title)?.starredCopies ?? 0) > 0).map((card) => card.title);
	const lines: ImpactLine[] = [];
	if (lastCopies.length > 0) lines.push({ text: `Ton dernier exemplaire : ${lastCopies.join(", ")}`, tone: "warning" });
	if (starred.length > 0) lines.push({ text: `En favori : ${starred.join(", ")}`, tone: "warning" });
	if (lines.length === 0) lines.push({ text: "Que des doublons, tu ne perds aucune carte", tone: "good" });
	return lines;
}
