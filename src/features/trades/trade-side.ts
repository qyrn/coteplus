import { normalizeTitle } from "../../lib/site/card-dom";
import { isRarity, type Rarity } from "../../lib/site/rarity";

export interface TradeCardChip {
	title: string;
	rarity: Rarity;
}

export interface TradeSide {
	container: HTMLElement;
	isMine: boolean;
	cards: TradeCardChip[];
	wikibidous: number;
}

const MY_SIDE_LABELS = new Set(["Vous offrez", "En échange de"]);
const THEIR_SIDE_PATTERN = /\soffre$/;
const CARD_CHIP_SELECTOR = 'span[title][style*="--color-rarity-"]';
const RARITY_PREFIX_PATTERN = /^\s*(L|UR|SR|R|PC|C)\s*·/;
const WIKIBIDOUS_PATTERN = /^([\d\s]+)\s*wb$/i;

export function readCardChip(chip: Element): TradeCardChip | null {
	const title = normalizeTitle(chip.getAttribute("title") ?? "");
	const rarity = RARITY_PREFIX_PATTERN.exec(chip.textContent ?? "")?.[1];
	if (!title || !rarity || !isRarity(rarity)) return null;
	return { title, rarity };
}

export function parseWikibidous(text: string): number | null {
	const digits = WIKIBIDOUS_PATTERN.exec(text.trim())?.[1]?.replace(/\s/g, "");
	return digits ? Number(digits) : null;
}

function readSide(label: HTMLParagraphElement): TradeSide | null {
	const labelText = label.textContent?.trim() ?? "";
	const isMine = MY_SIDE_LABELS.has(labelText);
	if (!isMine && !THEIR_SIDE_PATTERN.test(labelText)) return null;
	const container = label.parentElement;
	if (!container) return null;
	const cards = [...container.querySelectorAll(CARD_CHIP_SELECTOR)]
		.map(readCardChip)
		.filter((chip): chip is TradeCardChip => chip !== null);
	const wikibidous = [...container.querySelectorAll("span")]
		.map((span) => parseWikibidous(span.textContent ?? ""))
		.find((amount): amount is number => amount !== null);
	return { container, isMine, cards, wikibidous: wikibidous ?? 0 };
}

export function readTradeSides(trade: ParentNode): TradeSide[] {
	return [...trade.querySelectorAll("p")].map(readSide).filter((side): side is TradeSide => side !== null);
}

export function tradeKey(sides: TradeSide[]): string {
	return sides
		.map(
			(side) =>
				`${side.isMine}:${side.wikibidous}:${side.cards.map((card) => `${card.rarity}/${card.title}`).join(",")}`,
		)
		.join("|");
}
