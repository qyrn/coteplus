import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { amountElement, formatAmount } from "../../lib/ui/amount";
import { createButton } from "../../lib/ui/button";
import { createPanelHeader, note } from "../../lib/ui/panel";
import { rarityTag } from "../../lib/ui/rarity-tag";
import type { PriceService } from "../prices/price-service";
import type { LiveSettings } from "../settings/live-settings";
import { dealText } from "./auction-deal";
import { marketExtrasSlot } from "./market-extras-slot";
import { findWishAuctions, type RankedAuction, rankAuctions } from "./wish-auctions";
import { takeWishTarget, type WishTarget } from "./wish-target";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

const DEAL_TONES = { great: "great", fair: "neutral", expensive: "bad" } as const;

function rowFor(ranked: RankedAuction, isBest: boolean): HTMLLIElement {
	const row = document.createElement("li");
	const link = document.createElement("a");
	link.href = `/marketplace/${encodeURIComponent(ranked.auction.id)}`;
	link.className = "wmp-row wmp-wish-row";
	link.dataset.best = String(isBest);
	const deal = document.createElement("span");
	deal.className = "wmp-chip";
	deal.dataset.tone = ranked.deal ? DEAL_TONES[ranked.deal.level] : "neutral";
	deal.textContent = ranked.deal ? dealText(ranked.deal) : "prix moyen inconnu";
	const end = document.createElement("span");
	end.className = "wmp-row-muted";
	end.textContent = `fin ${timeFormatter.format(ranked.auction.endAt)}`;
	link.append(rarityTag(ranked.auction.rarity), amountElement(formatAmount(ranked.price)), deal, end);
	row.append(link);
	return row;
}

export function startWishAuctionsPanel(
	pageWatcher: PageWatcher,
	siteApi: RequestQueue,
	priceService: PriceService,
	settings: LiveSettings,
): void {
	const panel = document.createElement("section");
	panel.className = "wmp-panel wmp-wish-panel";
	panel.setAttribute("aria-live", "polite");
	let target: WishTarget | null = null;

	function show(title: string, content: Node): void {
		const header = createPanelHeader(title, "heart");
		const close = createButton("Fermer", "icon", "close");
		close.addEventListener("click", () => {
			target = null;
			panel.remove();
		});
		header.append(close);
		const body = document.createElement("div");
		body.className = "wmp-panel-body";
		body.append(content);
		panel.replaceChildren(header, body);
	}

	async function load(wish: WishTarget): Promise<void> {
		show(`Enchères en cours pour « ${wish.title} »`, note("Recherche…"));
		const auctions = await findWishAuctions(siteApi, wish.title).catch(() => null);
		if (!auctions) {
			show(`« ${wish.title} »`, note("Recherche impossible pour le moment."));
			return;
		}
		if (auctions.length === 0) {
			show(
				`Aucune enchère en cours pour « ${wish.title} »`,
				note("Ajoutée à ta liste de souhaits : le site te préviendra dès sa mise en vente."),
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
		const ranked = rankAuctions(auctions, averages, settings.current().greatDealPercent);
		const list = document.createElement("ul");
		list.className = "wmp-rows";
		list.append(...ranked.map((entry, index) => rowFor(entry, index === 0 && entry.deal !== null)));
		show(`${auctions.length} enchère${auctions.length > 1 ? "s" : ""} en cours pour « ${wish.title} »`, list);
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
