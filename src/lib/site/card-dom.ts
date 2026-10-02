import { isRarity, type Rarity } from "./rarity";

export interface CardView {
	element: HTMLElement;
	heading: HTMLHeadingElement;
	title: string;
	rarity: Rarity;
}

const CARD_SELECTOR = 'div[class*="glow-"]';
const GLOW_CLASS_PATTERN = /^glow-(c|pc|r|sr|ur|l)$/;

export function normalizeTitle(rawTitle: string): string {
	return rawTitle.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function readRarity(element: Element): Rarity | null {
	for (const className of element.classList) {
		const rarity = GLOW_CLASS_PATTERN.exec(className)?.[1]?.toUpperCase();
		if (rarity && isRarity(rarity)) return rarity;
	}
	return null;
}

export function readCard(element: HTMLElement): CardView | null {
	const rarity = readRarity(element);
	const heading = element.querySelector("h3");
	const title = normalizeTitle(heading?.textContent ?? "");
	if (!rarity || !heading || !title) return null;
	return { element, heading, title, rarity };
}

export function findCards(root: ParentNode): CardView[] {
	return [...root.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
		.map(readCard)
		.filter((card): card is CardView => card !== null);
}
