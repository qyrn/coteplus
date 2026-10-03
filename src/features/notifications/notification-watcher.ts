import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { NewSiteNotificationsMessage } from "./notification-messages";
import { latestCreatedAt, NOTIFICATIONS_URL, parseNotifications, unseenNotifications } from "./site-notification";

const BELL_SELECTOR = 'button[aria-label="Notifications"]';
const CAPPED_COUNT_PATTERN = /^(\d+)\+?$/;

const seenUntilItem = storage.defineItem<number>("local:site-notifications-seen-until", { fallback: 0 });

export function readUnreadCount(root: ParentNode): number {
	return [...root.querySelectorAll(BELL_SELECTOR)].reduce((highest, bell) => {
		const count = Number(CAPPED_COUNT_PATTERN.exec(bell.textContent?.trim() ?? "")?.[1] ?? 0);
		return Math.max(highest, count);
	}, 0);
}

export function startNotificationWatcher(pageWatcher: PageWatcher, siteApi: RequestQueue): void {
	let lastCount = 0;
	let checking: Promise<void> | null = null;

	async function check(): Promise<void> {
		const notifications = parseNotifications(await siteApi.getJson(NOTIFICATIONS_URL, "background"));
		const seenUntil = await seenUntilItem.getValue();
		await seenUntilItem.setValue(latestCreatedAt(notifications, seenUntil));
		const unseen = unseenNotifications(notifications, seenUntil);
		if (unseen.length === 0) return;
		const message: NewSiteNotificationsMessage = { type: "site-notifications/new", notifications: unseen };
		await browser.runtime.sendMessage(message);
	}

	void seenUntilItem.getValue().then((seenUntil) => {
		if (seenUntil === 0) void seenUntilItem.setValue(Date.now());
	});

	pageWatcher.subscribe(() => {
		const count = readUnreadCount(document);
		const increased = count > lastCount;
		lastCount = count;
		if (!increased || checking) return;
		checking = check()
			.catch(() => undefined)
			.finally(() => {
				checking = null;
			});
	});
}
