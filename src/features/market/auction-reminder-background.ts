import { browser } from "wxt/browser";
import { openSitePage } from "../../lib/browser/open-site-page";
import {
	dropLongEnded,
	dueReminders,
	type FollowedAuction,
	followedAuctionsItem,
	nextReminderAt,
	readFollowedAuctions,
} from "./followed-auctions";

const REMINDER_ALARM = "auction-reminder";
const NOTIFICATION_PREFIX = "auction-reminder:";
const GROUP_NOTIFICATION_ID = `${NOTIFICATION_PREFIX}group`;
const MINUTE_MS = 60 * 1000;

function minutesLeft(auction: FollowedAuction, now: number): number {
	return Math.max(1, Math.round((auction.endAt - now) / MINUTE_MS));
}

async function notify(auctions: FollowedAuction[], now: number): Promise<void> {
	const [single] = auctions;
	if (auctions.length === 1 && single) {
		await browser.notifications.create(`${NOTIFICATION_PREFIX}${single.id}`, {
			type: "basic",
			iconUrl: browser.runtime.getURL("/icon/128.png"),
			title: "Enchère bientôt terminée",
			message: `« ${single.title} » se termine dans ${minutesLeft(single, now)} min.`,
		});
		return;
	}
	await browser.notifications.create(GROUP_NOTIFICATION_ID, {
		type: "basic",
		iconUrl: browser.runtime.getURL("/icon/128.png"),
		title: "Enchères bientôt terminées",
		message: `${auctions.length} enchères suivies se terminent dans les prochaines minutes.`,
	});
}

async function processReminders(): Promise<void> {
	const now = Date.now();
	const followed = await followedAuctionsItem.getValue();
	const due = dueReminders(readFollowedAuctions(followed), now);
	if (due.length > 0) {
		const reminded = Object.fromEntries(due.map((auction) => [auction.id, { ...auction, remindedAt: now }]));
		await followedAuctionsItem.setValue({ ...followed, ...reminded });
		await notify(due, now);
	}
	await browser.alarms.clear(REMINDER_ALARM);
	const next = nextReminderAt(readFollowedAuctions(await followedAuctionsItem.getValue()), Date.now());
	if (next !== null) await browser.alarms.create(REMINDER_ALARM, { when: Math.max(next, Date.now() + 1000) });
}

async function cleanUpEnded(): Promise<void> {
	await followedAuctionsItem.setValue(dropLongEnded(await followedAuctionsItem.getValue(), Date.now()));
}

function auctionPathFor(notificationId: string): string {
	const auctionId = notificationId.slice(NOTIFICATION_PREFIX.length);
	return notificationId === GROUP_NOTIFICATION_ID ? "/marketplace" : `/marketplace/${encodeURIComponent(auctionId)}`;
}

export function startAuctionReminders(): void {
	followedAuctionsItem.watch(() => void processReminders());
	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === REMINDER_ALARM) void processReminders();
	});
	browser.notifications.onClicked.addListener((notificationId) => {
		if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
		void browser.notifications.clear(notificationId);
		void openSitePage(auctionPathFor(notificationId));
	});
	const startUp = () => void cleanUpEnded().then(processReminders);
	browser.runtime.onStartup.addListener(startUp);
	browser.runtime.onInstalled.addListener(startUp);
}
