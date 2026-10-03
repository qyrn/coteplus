import type { Rarity } from "../../lib/site/rarity";
import type { FoundImage } from "./found-image";

const COVER_CLASS = "wmp-card-cover";
const MAX_INITIALS = 2;
const FILLED_IMAGE_STYLE = {
	width: "100%",
	height: "100%",
	padding: "0",
	"object-fit": "cover",
	opacity: "1",
	filter: "none",
};

export function initialsFor(title: string): string {
	return title
		.replace(/\([^)]*\)/g, " ")
		.split(/[\s'’-]+/)
		.filter((word) => /^\p{L}/u.test(word))
		.slice(0, MAX_INITIALS)
		.map((word) => word.charAt(0).toLocaleUpperCase("fr-FR"))
		.join("");
}

export function showCover(placeholder: HTMLImageElement, title: string, rarity: Rarity): void {
	const container = placeholder.parentElement;
	if (!container || container.querySelector(`.${COVER_CLASS}`)) return;
	const cover = document.createElement("div");
	cover.className = COVER_CLASS;
	cover.style.setProperty("--wmp-cover-color", `var(--color-rarity-${rarity.toLowerCase()})`);
	cover.textContent = initialsFor(title);
	cover.setAttribute("aria-hidden", "true");
	placeholder.style.setProperty("display", "none");
	container.append(cover);
}

export function showImage(placeholder: HTMLImageElement, image: FoundImage, title: string, rarity: Rarity): void {
	placeholder.addEventListener("error", () => showCover(placeholder, title, rarity), { once: true });
	placeholder.removeAttribute("srcset");
	placeholder.removeAttribute("sizes");
	for (const [property, value] of Object.entries(FILLED_IMAGE_STYLE)) placeholder.style.setProperty(property, value);
	placeholder.alt = title;
	if (image.credit) placeholder.title = image.credit;
	placeholder.src = image.url;
}
