import type { PageWatcher } from "../../lib/site/page-watcher";
import { type OwnedCard, ownedCardsItem } from "../cards/collection-index";
import type { PriceService } from "../prices/price-service";
import { givenImpact, type ImpactLine, ownedByTitle, receivedImpact } from "./trade-impact";
import { readTradeSides, type TradeSide, tradeKey } from "./trade-side";

const TRADE_SELECTOR = 'button[aria-label="Voir le détail de l\'échange"]';
const HANDLED_KEY_ATTRIBUTE = "data-wmp-trade-for";
const SIDE_VALUE_CLASS = "wmp-trade-side-value";
const BALANCE_CLASS = "wmp-trade-balance";
const IMPACT_CLASS = "wmp-trade-impact";
const PENDING_STATUS = "En attente";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export interface SideValue {
	total: number;
	unpricedCards: number;
}

export function sideValueText(value: SideValue): string {
	const unpriced = value.unpricedCards > 0 ? ` (${value.unpricedCards} sans prix)` : "";
	return `≈ ${amountFormatter.format(value.total)} W${unpriced}`;
}

export function isBalanceComplete(mine: SideValue, theirs: SideValue): boolean {
	return mine.unpricedCards === 0 && theirs.unpricedCards === 0;
}

export function balanceText(mine: SideValue, theirs: SideValue): string {
	const balance = Math.round(theirs.total - mine.total);
	const complete = isBalanceComplete(mine, theirs);
	if (balance === 0) return complete ? "Échange équilibré" : "Bilan incomplet";
	const sign = balance > 0 ? "+" : "−";
	const amount = `Bilan pour toi : ${sign}${amountFormatter.format(Math.abs(balance))} W`;
	return complete ? amount : `${amount} (incomplet)`;
}

function isPendingTrade(trade: HTMLElement): boolean {
	return trade.textContent?.includes(PENDING_STATUS) ?? false;
}

async function estimateSideValue(side: TradeSide, priceService: PriceService): Promise<SideValue> {
	const cotes = await Promise.all(
		side.cards.map((card) =>
			priceService
				.getPrice(card.title, card.rarity)
				.then((price) => price.value)
				.catch(() => null),
		),
	);
	const priced = cotes.filter((cote): cote is number => cote !== null);
	return {
		total: side.wikibidous + priced.reduce((sum, cote) => sum + cote, 0),
		unpricedCards: cotes.length - priced.length,
	};
}

function renderSideValue(side: TradeSide, value: SideValue): void {
	const line = side.container.querySelector(`.${SIDE_VALUE_CLASS}`) ?? document.createElement("p");
	line.className = SIDE_VALUE_CLASS;
	line.textContent = sideValueText(value);
	if (!line.isConnected) side.container.append(line);
}

function renderImpact(side: TradeSide, owned: ReadonlyMap<string, OwnedCard>): void {
	side.container.querySelector(`.${IMPACT_CLASS}`)?.remove();
	const lines: ImpactLine[] = side.isMine ? givenImpact(side.cards, owned) : receivedImpact(side.cards, owned);
	if (lines.length === 0) return;
	const list = document.createElement("ul");
	list.className = IMPACT_CLASS;
	list.append(
		...lines.map((line) => {
			const item = document.createElement("li");
			item.dataset.tone = line.tone;
			item.textContent = line.text;
			return item;
		}),
	);
	side.container.append(list);
}

function renderBalance(trade: HTMLElement, text: string, balanceSign: number): void {
	const header = trade.firstElementChild?.firstElementChild;
	if (!header) return;
	const chip = header.querySelector<HTMLElement>(`.${BALANCE_CLASS}`) ?? document.createElement("span");
	chip.className = `wmp-chip ${BALANCE_CLASS}`;
	chip.dataset.tone = balanceSign > 0 ? "good" : balanceSign < 0 ? "bad" : "neutral";
	chip.textContent = text;
	if (!chip.isConnected) header.append(chip);
}

async function showTradeValues(trade: HTMLElement, sides: TradeSide[], priceService: PriceService): Promise<void> {
	const key = tradeKey(sides);
	trade.setAttribute(HANDLED_KEY_ATTRIBUTE, key);
	const [values, ownedCards] = await Promise.all([
		Promise.all(sides.map((side) => estimateSideValue(side, priceService))),
		ownedCardsItem.getValue(),
	]);
	if (trade.getAttribute(HANDLED_KEY_ATTRIBUTE) !== key) return;
	sides.forEach((side, index) => {
		const value = values[index];
		if (value && (side.cards.length > 0 || side.wikibidous > 0)) renderSideValue(side, value);
	});
	const owned = ownedByTitle(ownedCards);
	if (owned.size > 0 && isPendingTrade(trade)) for (const side of sides) renderImpact(side, owned);
	const mineIndex = sides.findIndex((side) => side.isMine);
	const theirsIndex = sides.findIndex((side) => !side.isMine);
	const mine = values[mineIndex];
	const theirs = values[theirsIndex];
	if (mine && theirs) {
		const tone = isBalanceComplete(mine, theirs) ? Math.round(theirs.total - mine.total) : 0;
		renderBalance(trade, balanceText(mine, theirs), tone);
	}
}

export function startTradeValues(pageWatcher: PageWatcher, priceService: PriceService): void {
	pageWatcher.subscribe(() => {
		if (location.pathname !== "/trades") return;
		for (const trade of document.querySelectorAll<HTMLElement>(TRADE_SELECTOR)) {
			const sides = readTradeSides(trade);
			if (sides.length === 0 || trade.getAttribute(HANDLED_KEY_ATTRIBUTE) === tradeKey(sides)) continue;
			void showTradeValues(trade, sides, priceService);
		}
	});
}
