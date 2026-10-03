import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { CardView } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { handleCardsWhenVisible } from "../../lib/site/visible-cards";
import type { PriceService } from "../prices/price-service";
import type { LiveSettings } from "../settings/live-settings";
import { compareToAverage, dealText, readAuctionPrice } from "./auction-deal";
import { AUCTION_TILE_SELECTOR } from "./auction-tile-actions";

const DEAL_CHIP_CLASS = "wmp-deal-chip";
const GREAT_DEAL_CLASS = "wmp-great-deal";
const HANDLED_KEY_ATTRIBUTE = "data-wmp-deal-for";

interface AuctionTile {
	tile: HTMLElement;
	priceElement: HTMLElement;
	amount: number;
	key: string;
}

function readAuctionTile(card: CardView): AuctionTile | null {
	const tile = card.element.closest<HTMLElement>(AUCTION_TILE_SELECTOR);
	const price = tile ? readAuctionPrice(tile) : null;
	if (!tile || !price) return null;
	return { tile, priceElement: price.element, amount: price.amount, key: `${card.title}|${price.amount}` };
}

function isHandled(card: CardView): boolean {
	const auction = readAuctionTile(card);
	return !auction || auction.tile.getAttribute(HANDLED_KEY_ATTRIBUTE) === auction.key;
}

function renderDeal(auction: AuctionTile, text: string | null, isGreatDeal: boolean): void {
	auction.tile.querySelector(`.${DEAL_CHIP_CLASS}`)?.remove();
	auction.tile.classList.toggle(GREAT_DEAL_CLASS, isGreatDeal);
	if (!text) return;
	const chip = document.createElement("span");
	chip.className = DEAL_CHIP_CLASS;
	chip.dataset.level = isGreatDeal ? "great" : "other";
	chip.textContent = text;
	const priceRow = auction.priceElement.parentElement?.parentElement;
	priceRow?.insertAdjacentElement("afterend", chip);
}

async function showDeal(card: CardView, priceService: PriceService, settings: LiveSettings): Promise<void> {
	const auction = readAuctionTile(card);
	if (!auction) return;
	auction.tile.setAttribute(HANDLED_KEY_ATTRIBUTE, auction.key);
	const { average } = await priceService.getAveragePrice(card.title, card.rarity).catch(() => ({ average: null }));
	const current = readAuctionTile(card);
	if (current?.key !== auction.key) return;
	const deal = average === null ? null : compareToAverage(auction.amount, average, settings.current().greatDealPercent);
	renderDeal(current, deal ? dealText(deal) : null, deal?.level === "great");
}

export function startMarketDeals(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
	settings: LiveSettings,
): void {
	handleCardsWhenVisible(ctx, pageWatcher, {
		isHandled,
		onVisible: (card) => void showDeal(card, priceService, settings),
	});
}
