import { browser } from "wxt/browser";
import { openSitePage } from "../../lib/browser/open-site-page";
import { isQuietTime, loadSettings } from "../settings/settings";
import { isNewSiteNotificationsMessage } from "./notification-messages";
import type { SiteNotification } from "./site-notification";

const NOTIFICATION_PREFIX = "site-notification:";
const PATH_SEPARATOR = "#";
const MAX_SEPARATE_NOTIFICATIONS = 3;

function notificationId(path: string, suffix: string): string {
	return `${NOTIFICATION_PREFIX}${path}${PATH_SEPARATOR}${suffix}`;
}

function pathOf(id: string): string {
	return id.slice(NOTIFICATION_PREFIX.length).split(PATH_SEPARATOR)[0] ?? "/";
}

async function show(id: string, title: string, message: string): Promise<void> {
	await browser.notifications.create(id, {
		type: "basic",
		iconUrl: browser.runtime.getURL("/icon/128.png"),
		title,
		message,
	});
}

async function notify(notifications: SiteNotification[]): Promise<void> {
	const settings = await loadSettings();
	if (isQuietTime(settings.quietHours, new Date())) return;
	const wanted = notifications.filter((notification) => settings.notificationCategories[notification.category]);
	if (wanted.length > MAX_SEPARATE_NOTIFICATIONS) {
		await show(
			notificationId("/", String(Date.now())),
			"WikiMasters",
			`${wanted.length} nouvelles notifications sur le site.`,
		);
		return;
	}
	await Promise.all(
		wanted.map((notification) =>
			show(notificationId(notification.path, notification.id), notification.title, notification.message),
		),
	);
}

export function startNotificationAlerts(): void {
	browser.runtime.onMessage.addListener((message: unknown) => {
		if (isNewSiteNotificationsMessage(message)) void notify(message.notifications);
	});
	browser.notifications.onClicked.addListener((id) => {
		if (!id.startsWith(NOTIFICATION_PREFIX)) return;
		void browser.notifications.clear(id);
		void openSitePage(pathOf(id));
	});
}
