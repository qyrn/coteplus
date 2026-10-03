import { browser } from "wxt/browser";
import { openSitePage } from "../../lib/browser/open-site-page";
import { isQuietTime, loadSettings } from "../settings/settings";
import { followedAuctionsItem } from "./followed-auctions";
import { type StandingChange, standingChanges } from "./standing-changes";

const NOTIFICATION_PREFIX = "auction-standing:";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function notificationContent({ kind, auction }: StandingChange): { title: string; message: string } {
	const amount = auction.currentBid === null ? "" : ` (${amountFormatter.format(auction.currentBid)} W)`;
	return kind === "outbid"
		? { title: "Tu as été dépassé", message: `Quelqu'un a surenchéri sur « ${auction.title} »${amount}.` }
		: { title: "Enchère gagnée", message: `« ${auction.title} » est à toi${amount}.` };
}

async function notifyChanges(changes: StandingChange[]): Promise<void> {
	if (changes.length === 0) return;
	const settings = await loadSettings();
	if (!settings.standingNotification || isQuietTime(settings.quietHours, new Date())) return;
	await Promise.all(
		changes.map((change) =>
			browser.notifications.create(`${NOTIFICATION_PREFIX}${change.kind}:${change.auction.id}`, {
				type: "basic",
				iconUrl: browser.runtime.getURL("/icon/128.png"),
				...notificationContent(change),
			}),
		),
	);
}

export function startStandingAlerts(): void {
	followedAuctionsItem.watch((next, previous) => void notifyChanges(standingChanges(previous, next)));
	browser.notifications.onClicked.addListener((notificationId) => {
		if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
		const auctionId = notificationId.split(":").at(-1) ?? "";
		void browser.notifications.clear(notificationId);
		void openSitePage(`/marketplace/${encodeURIComponent(auctionId)}`);
	});
}
