import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { storage } from "wxt/utils/storage";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { PageWatcher } from "../../lib/site/page-watcher";
import type { NewSiteNotificationsMessage } from "./notification-messages";
import { latestCreatedAt, NOTIFICATIONS_URL, parseNotifications, unseenNotifications } from "./site-notification";

const BELL_SELECTOR = 'button[aria-label="Notifications"]';
const COUNT_PATTERN = /^(\d+)(\+?)$/;
const CAPPED_RECHECK_MS = 2 * 60 * 1000;

export interface UnreadCount {
	count: number;
	capped: boolean;
}

const seenUntilItem = storage.defineItem<number>("local:site-notifications-seen-until", { fallback: 0 });

export function readUnreadCount(root: ParentNode): UnreadCount {
	return [...root.querySelectorAll(BELL_SELECTOR)].reduce<UnreadCount>(
		(highest, bell) => {
			const match = COUNT_PATTERN.exec(bell.textContent?.trim() ?? "");
			const count = Number(match?.[1] ?? 0);
			return count > highest.count ? { count, capped: match?.[2] === "+" } : highest;
		},
		{ count: 0, capped: false },
	);
}

export function startNotificationWatcher(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	siteApi: RequestQueue,
): void {
	let lastCount = 0;
	let capped = false;
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

	function startCheck(): void {
		if (checking) return;
		checking = check()
			.catch(() => undefined)
			.finally(() => {
				checking = null;
			});
	}

	void seenUntilItem.getValue().then((seenUntil) => {
		if (seenUntil === 0) void seenUntilItem.setValue(Date.now());
	});

	ctx.setInterval(() => {
		if (capped && document.visibilityState === "visible") startCheck();
	}, CAPPED_RECHECK_MS);

	pageWatcher.subscribe(() => {
		const unread = readUnreadCount(document);
		const increased = unread.count > lastCount;
		lastCount = unread.count;
		capped = unread.capped;
		if (increased) startCheck();
	});
}
