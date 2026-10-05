import type { AuctionStanding, FollowedAuction } from "../../features/market/followed-auctions";
import { icon } from "../../lib/ui/icons";
import { timeUntil } from "./relative-time";

export interface AuctionSectionElements {
	list: HTMLUListElement;
	empty: HTMLElement;
}

export interface AuctionActions {
	open(auction: FollowedAuction): void;
	unfollow(auction: FollowedAuction): void;
}

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const STANDING_LABELS: Record<AuctionStanding, string> = {
	leading: "En tête",
	outbid: "Dépassé",
	won: "Gagnée",
	lost: "Perdue",
};

export function isShownInPopup(auction: FollowedAuction, now: number): boolean {
	return auction.endAt > now || auction.standing === "won" || auction.standing === "leading";
}

export function standingText(auction: FollowedAuction): string | null {
	if (!auction.standing) return null;
	const label = STANDING_LABELS[auction.standing];
	return auction.currentBid === null ? label : `${label} · ${amountFormatter.format(auction.currentBid)} W`;
}

function buildStatusLine(auction: FollowedAuction, now: number): HTMLSpanElement {
	const line = document.createElement("span");
	line.className = "auction-time";
	const standing = standingText(auction);
	const bidNote = !standing && auction.source === "bid" ? " · ta mise" : "";
	line.append(`${timeUntil(auction.endAt, now)}${bidNote}`);
	if (standing && auction.standing) {
		const chip = document.createElement("span");
		chip.className = "standing";
		chip.dataset.standing = auction.standing;
		chip.textContent = standing;
		line.append(chip);
	}
	return line;
}

function buildRow(auction: FollowedAuction, now: number, actions: AuctionActions): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "auction-row";
	row.dataset.ended = String(auction.endAt <= now);

	const rarity = document.createElement("span");
	rarity.className = "rarity";
	rarity.dataset.rarity = auction.rarity;
	rarity.textContent = auction.rarity;

	const openButton = document.createElement("button");
	openButton.type = "button";
	openButton.className = "auction-open";
	const title = document.createElement("span");
	title.className = "auction-title";
	title.textContent = auction.title;
	openButton.append(title, buildStatusLine(auction, now));
	openButton.addEventListener("click", () => actions.open(auction));

	const unfollowButton = document.createElement("button");
	unfollowButton.type = "button";
	unfollowButton.className = "btn btn-icon";
	unfollowButton.append(icon("close"));
	unfollowButton.setAttribute("aria-label", `Ne plus suivre ${auction.title}`);
	unfollowButton.addEventListener("click", () => actions.unfollow(auction));

	row.append(rarity, openButton, unfollowButton);
	return row;
}

export function renderAuctionSection(
	elements: AuctionSectionElements,
	auctions: FollowedAuction[],
	now: number,
	actions: AuctionActions,
): void {
	const sorted = [...auctions].sort((left, right) => {
		const leftEnded = left.endAt <= now;
		const rightEnded = right.endAt <= now;
		if (leftEnded !== rightEnded) return leftEnded ? 1 : -1;
		return leftEnded ? right.endAt - left.endAt : left.endAt - right.endAt;
	});
	elements.list.replaceChildren(...sorted.map((auction) => buildRow(auction, now, actions)));
	elements.empty.hidden = sorted.length > 0;
}
