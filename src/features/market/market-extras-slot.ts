const SLOT_ID = "wmp-market-extras";
const TABS_FIRST_LABEL = "Parcourir";

function findTabsBar(): HTMLElement | null {
	const firstTab = [...document.querySelectorAll<HTMLButtonElement>("main button")].find(
		(button) => button.textContent?.trim() === TABS_FIRST_LABEL,
	);
	return firstTab?.parentElement ?? null;
}

export function marketExtrasSlot(): HTMLElement | null {
	const tabsBar = findTabsBar();
	if (!tabsBar) return null;
	const existing = document.getElementById(SLOT_ID);
	if (existing && existing.nextElementSibling === tabsBar) return existing;
	const slot = existing ?? document.createElement("div");
	slot.id = SLOT_ID;
	slot.className = "wmp-market-extras";
	tabsBar.insertAdjacentElement("beforebegin", slot);
	return slot;
}
