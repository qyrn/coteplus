import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { type CardView, isStillShown } from "../../lib/site/card-dom";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { handleCardsWhenVisible } from "../../lib/site/visible-cards";
import type { PriceService } from "../prices/price-service";
import type { LiveSettings } from "../settings/live-settings";
import { type AuctionDeal, compareToCote, dealText, readAuctionAmount } from "./auction-deal";
import { AUCTION_TILE_SELECTOR, tileActions } from "./auction-tile-actions";

const DEAL_CHIP_CLASS = "wmp-deal-chip";
const GREAT_DEAL_CLASS = "wmp-great-deal";
const HANDLED_KEY_ATTRIBUTE = "data-wmp-deal-for";

interface AuctionTile {
	tile: HTMLElement;
	amount: number;
	key: string;
}

function readAuctionTile(card: CardView): AuctionTile | null {
	const tile = card.element.closest<HTMLElement>(AUCTION_TILE_SELECTOR);
	const amount = tile ? readAuctionAmount(tile) : null;
	if (!tile || amount === null) return null;
	return { tile, amount, key: `${card.title}|${amount}` };
}

function isHandled(card: CardView): boolean {
	const auction = readAuctionTile(card);
	return !auction || auction.tile.getAttribute(HANDLED_KEY_ATTRIBUTE) === auction.key;
}

const DEAL_TONES = { great: "great", fair: "neutral", expensive: "bad" } as const;

function renderDeal(auction: AuctionTile, deal: AuctionDeal | null): void {
	auction.tile.querySelector(`.${DEAL_CHIP_CLASS}`)?.remove();
	auction.tile.classList.toggle(GREAT_DEAL_CLASS, deal?.level === "great");
	if (!deal) return;
	const chip = document.createElement("span");
	chip.className = `wmp-chip ${DEAL_CHIP_CLASS}`;
	chip.dataset.tone = DEAL_TONES[deal.level];
	chip.textContent = dealText(deal);
	tileActions(auction.tile).prepend(chip);
}

async function showDeal(card: CardView, priceService: PriceService, settings: LiveSettings): Promise<void> {
	const auction = readAuctionTile(card);
	if (!auction) return;
	auction.tile.setAttribute(HANDLED_KEY_ATTRIBUTE, auction.key);
	const { value: cote } = await priceService
		.getPrice(card.title, card.rarity, () => isStillShown(card))
		.catch(() => ({ value: null }));
	const current = readAuctionTile(card);
	if (current?.key !== auction.key) return;
	const deal = cote === null ? null : compareToCote(auction.amount, cote, settings.current().greatDealPercent);
	renderDeal(current, deal);
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
