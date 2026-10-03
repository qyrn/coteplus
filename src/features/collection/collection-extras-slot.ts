const SLOT_ID = "wmp-collection-extras";
const SEARCH_PLACEHOLDER_PREFIX = "Rechercher";

function findFiltersBlock(): HTMLElement | null {
	const searchInput = [...document.querySelectorAll<HTMLInputElement>("main input")].find((input) =>
		input.placeholder.startsWith(SEARCH_PLACEHOLDER_PREFIX),
	);
	return searchInput?.parentElement?.parentElement ?? null;
}

export function collectionExtrasSlot(): HTMLElement | null {
	const filtersBlock = findFiltersBlock();
	if (!filtersBlock) return null;
	const existing = document.getElementById(SLOT_ID);
	if (existing && existing.parentElement === filtersBlock && filtersBlock.firstElementChild === existing)
		return existing;
	const slot = existing ?? document.createElement("div");
	slot.id = SLOT_ID;
	slot.className = "wmp-collection-extras";
	filtersBlock.prepend(slot);
	return slot;
}
