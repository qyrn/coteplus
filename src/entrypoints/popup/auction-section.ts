import type { FollowedAuction } from "../../features/market/followed-auctions";
import { timeUntil } from "./relative-time";

export interface AuctionSectionElements {
	list: HTMLUListElement;
	empty: HTMLElement;
}

export interface AuctionActions {
	open(auction: FollowedAuction): void;
	unfollow(auction: FollowedAuction): void;
}

function buildRow(auction: FollowedAuction, now: number, actions: AuctionActions): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "auction-row";
	row.dataset.ended = String(auction.endAt <= now);

	const rarity = document.createElement("span");
	rarity.className = "rarity-pill";
	rarity.dataset.rarity = auction.rarity;
	rarity.textContent = auction.rarity;

	const openButton = document.createElement("button");
	openButton.type = "button";
	openButton.className = "auction-open";
	const title = document.createElement("span");
	title.className = "auction-title";
	title.textContent = auction.title;
	const time = document.createElement("span");
	time.className = "auction-time";
	time.textContent = `${timeUntil(auction.endAt, now)}${auction.source === "bid" ? " · ta mise" : ""}`;
	openButton.append(title, time);
	openButton.addEventListener("click", () => actions.open(auction));

	const unfollowButton = document.createElement("button");
	unfollowButton.type = "button";
	unfollowButton.className = "auction-unfollow";
	unfollowButton.textContent = "×";
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
