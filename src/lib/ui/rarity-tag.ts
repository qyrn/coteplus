import type { Rarity } from "../site/rarity";

export function rarityTag(rarity: Rarity): HTMLSpanElement {
	const tag = document.createElement("span");
	tag.className = "wmp-rarity";
	tag.dataset.rarity = rarity;
	tag.textContent = rarity;
	return tag;
}
