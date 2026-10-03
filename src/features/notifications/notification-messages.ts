import { isRecord } from "../../lib/json";
import type { NotificationCategory, SiteNotification } from "./site-notification";

export interface NewSiteNotificationsMessage {
	type: "site-notifications/new";
	notifications: SiteNotification[];
}

const CATEGORIES: readonly string[] = ["market", "trades", "battles", "friends", "other"];

function isCategory(value: unknown): value is NotificationCategory {
	return typeof value === "string" && CATEGORIES.includes(value);
}

function isSiteNotification(value: unknown): value is SiteNotification {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.type === "string" &&
		isCategory(value.category) &&
		typeof value.title === "string" &&
		typeof value.message === "string" &&
		typeof value.createdAt === "number" &&
		typeof value.read === "boolean" &&
		typeof value.path === "string" &&
		value.path.startsWith("/")
	);
}

export function isNewSiteNotificationsMessage(value: unknown): value is NewSiteNotificationsMessage {
	return (
		isRecord(value) &&
		value.type === "site-notifications/new" &&
		Array.isArray(value.notifications) &&
		value.notifications.every(isSiteNotification)
	);
}
