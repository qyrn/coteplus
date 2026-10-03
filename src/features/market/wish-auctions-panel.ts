import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { PriceService } from "../prices/price-service";
import { dealText } from "./auction-deal";
import { marketExtrasSlot } from "./market-extras-slot";
import { findWishAuctions, type RankedAuction, rankAuctions } from "./wish-auctions";
import { takeWishTarget, type WishTarget } from "./wish-target";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function rowFor(ranked: RankedAuction, isBest: boolean): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-wish-row";
	row.dataset.best = String(isBest);
	row.dataset.great = String(ranked.deal?.level === "great");
	const link = document.createElement("a");
	link.href = `/marketplace/${encodeURIComponent(ranked.auction.id)}`;
	link.className = "wmp-wish-link";
	const price = document.createElement("span");
	price.className = "wmp-wish-price";
	price.textContent = `${amountFormatter.format(ranked.price)} W`;
	const rarity = document.createElement("span");
	rarity.className = "wmp-wish-rarity";
	rarity.textContent = ranked.auction.rarity;
	const deal = document.createElement("span");
	deal.className = "wmp-wish-deal";
	deal.textContent = ranked.deal ? dealText(ranked.deal) : "prix moyen inconnu";
	const end = document.createElement("span");
	end.className = "wmp-wish-end";
	end.textContent = `fin ${timeFormatter.format(ranked.auction.endAt)}`;
	link.append(rarity, price, deal, end);
	row.append(link);
	return row;
}

export function startWishAuctionsPanel(
	pageWatcher: PageWatcher,
	siteApi: RequestQueue,
	priceService: PriceService,
): void {
	const panel = document.createElement("section");
	panel.className = "wmp-wish-panel";
	panel.setAttribute("aria-live", "polite");
	let target: WishTarget | null = null;

	function header(text: string): HTMLElement {
		const head = document.createElement("div");
		head.className = "wmp-wish-head";
		const title = document.createElement("h2");
		title.textContent = text;
		const close = document.createElement("button");
		close.type = "button";
		close.className = "wmp-wish-close";
		close.textContent = "×";
		close.setAttribute("aria-label", "Fermer");
		close.addEventListener("click", () => {
			target = null;
			panel.remove();
		});
		head.append(title, close);
		return head;
	}

	async function load(wish: WishTarget): Promise<void> {
		panel.replaceChildren(header(`Enchères en cours pour « ${wish.title} »`), document.createTextNode("Recherche…"));
		const auctions = await findWishAuctions(siteApi, wish.title).catch(() => null);
		if (!auctions) {
			panel.replaceChildren(
				header(`« ${wish.title} »`),
				document.createTextNode("Recherche impossible pour le moment."),
			);
			return;
		}
		if (auctions.length === 0) {
			panel.replaceChildren(
				header(`Aucune enchère en cours pour « ${wish.title} »`),
				document.createTextNode("Ajoutée à ta liste de souhaits : le site te préviendra dès sa mise en vente."),
			);
			return;
		}
		const averages = await Promise.all(
			auctions.map((auction) =>
				priceService
					.getAveragePrice(auction.title, auction.rarity)
					.then((price) => price.average)
					.catch(() => null),
			),
		);
		const ranked = rankAuctions(auctions, averages);
		const list = document.createElement("ul");
		list.className = "wmp-wish-list";
		list.append(...ranked.map((entry, index) => rowFor(entry, index === 0 && entry.deal !== null)));
		panel.replaceChildren(
			header(`${auctions.length} enchère${auctions.length > 1 ? "s" : ""} en cours pour « ${wish.title} »`),
			list,
		);
	}

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/marketplace") return;
		if (!target) {
			target = takeWishTarget();
			if (target) void load(target);
		}
		const slot = target ? marketExtrasSlot() : null;
		if (slot && panel.parentElement !== slot) slot.append(panel);
	});
}
