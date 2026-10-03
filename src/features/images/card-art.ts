import type { CardView } from "../../lib/site/card-dom";
import type { FoundImage } from "./found-image";

const ART_OVERLAY_CLASS = "wmp-art-overlay";
const COVER_CLASS = "wmp-card-cover";
const MAX_INITIALS = 2;

export function initialsFor(title: string): string {
	return title
		.replace(/\([^)]*\)/g, " ")
		.split(/[\s'’-]+/)
		.filter((word) => /^\p{L}/u.test(word))
		.slice(0, MAX_INITIALS)
		.map((word) => word.charAt(0).toLocaleUpperCase("fr-FR"))
		.join("");
}

function findArtArea(card: CardView, placeholder: HTMLImageElement): HTMLElement | null {
	for (let element = placeholder.parentElement; element && element !== card.element; element = element.parentElement) {
		if (getComputedStyle(element).position === "absolute") return element;
	}
	return placeholder.parentElement;
}

function replaceArt(card: CardView, placeholder: HTMLImageElement, overlay: HTMLElement): void {
	const artArea = findArtArea(card, placeholder);
	if (!artArea) return;
	artArea.querySelector(`.${ART_OVERLAY_CLASS}`)?.remove();
	const logoWrapper = [...artArea.children].find((child) => child.contains(placeholder));
	if (logoWrapper instanceof HTMLElement) logoWrapper.style.setProperty("display", "none");
	overlay.classList.add(ART_OVERLAY_CLASS);
	artArea.append(overlay);
}

export function showCover(card: CardView, placeholder: HTMLImageElement): void {
	const cover = document.createElement("div");
	cover.className = COVER_CLASS;
	cover.style.setProperty("--wmp-cover-color", `var(--color-rarity-${card.rarity.toLowerCase()})`);
	cover.textContent = initialsFor(card.title);
	cover.setAttribute("aria-hidden", "true");
	replaceArt(card, placeholder, cover);
}

export function showImage(card: CardView, placeholder: HTMLImageElement, image: FoundImage): void {
	const art = document.createElement("img");
	art.alt = card.title;
	art.decoding = "async";
	art.referrerPolicy = "no-referrer";
	if (image.credit) art.title = image.credit;
	art.addEventListener("error", () => showCover(card, placeholder), { once: true });
	art.src = image.url;
	replaceArt(card, placeholder, art);
}
