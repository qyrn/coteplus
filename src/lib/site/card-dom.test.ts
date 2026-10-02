import { describe, expect, it } from "vitest";
import { findCards, normalizeTitle, readRarity } from "./card-dom";

function cardMarkup(glowClass: string, title: string): string {
	return `<div class="${glowClass} rounded-2xl cursor-pointer"><div>L</div><div><h3>${title}</h3><p>catégorie</p></div></div>`;
}

describe("normalizeTitle", () => {
	it("collapses whitespace and trims", () => {
		expect(normalizeTitle("  Miss   Univers\n2016 ")).toBe("Miss Univers 2016");
	});
});

describe("readRarity", () => {
	it("reads the rarity from the exact glow class", () => {
		const element = document.createElement("div");
		element.className = "hover:glow-l glow-sr rounded-2xl";
		expect(readRarity(element)).toBe("SR");
	});

	it("returns null without a rarity glow class", () => {
		const element = document.createElement("div");
		element.className = "glow-pulse";
		expect(readRarity(element)).toBeNull();
	});
});

describe("findCards", () => {
	it("finds every card with a title and a rarity", () => {
		document.body.innerHTML = `${cardMarkup("glow-l", "Benjamin Castaldi")}${cardMarkup("glow-pc", "Hibou")}<div class="glow-r"></div>`;
		const cards = findCards(document.body);
		expect(cards.map((card) => [card.title, card.rarity])).toEqual([
			["Benjamin Castaldi", "L"],
			["Hibou", "PC"],
		]);
	});
});
