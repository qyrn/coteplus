import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, readCard } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { handleCardsWhenVisible } from "../../lib/site/visible-cards";
import type { CardCatalog } from "../cards/card-catalog";
import { showCover, showImage } from "./card-art";
import type { CardImageService } from "./card-image-service";

const PLACEHOLDER_SELECTOR = 'img[alt="WikiMasters"]';
const HANDLED_TITLE_ATTRIBUTE = "data-wmp-image-for";

function findPlaceholder(card: CardView): HTMLImageElement | null {
	return card.element.querySelector<HTMLImageElement>(PLACEHOLDER_SELECTOR);
}

function isHandled(card: CardView): boolean {
	return card.element.getAttribute(HANDLED_TITLE_ATTRIBUTE) === card.title || findPlaceholder(card) === null;
}

async function fillMissingImage(card: CardView, catalog: CardCatalog, imageService: CardImageService): Promise<void> {
	card.element.setAttribute(HANDLED_TITLE_ATTRIBUTE, card.title);
	const cardRef = await catalog.resolve(card.title, card.rarity).catch(() => null);
	if (cardRef?.hideImage) return;
	const image = await imageService.findImage(card.title).catch(() => null);
	const placeholder = findPlaceholder(card);
	if (!placeholder || readCard(card.element)?.title !== card.title) return;
	if (image) showImage(card, placeholder, image);
	else showCover(card, placeholder);
}

export function startMissingImages(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	catalog: CardCatalog,
	imageService: CardImageService,
): void {
	handleCardsWhenVisible(ctx, pageWatcher, {
		isHandled,
		onVisible: (card) => void fillMissingImage(card, catalog, imageService),
	});
}
