import { isRecord } from "../../lib/json";

export type NotificationCategory = "market" | "trades" | "battles" | "friends" | "other";

export interface SiteNotification {
	id: string;
	type: string;
	category: NotificationCategory;
	title: string;
	message: string;
	createdAt: number;
	read: boolean;
	path: string;
}

export const NOTIFICATIONS_URL = "/api/notifications";

const CATEGORY_PREFIXES: ReadonlyArray<[string, NotificationCategory]> = [
	["marketplace_", "market"],
	["trade_", "trades"],
	["battle_", "battles"],
	["friend", "friends"],
];

const CATEGORY_TITLES: Record<NotificationCategory, string> = {
	market: "Marché",
	trades: "Échanges",
	battles: "Bataille",
	friends: "Amis",
	other: "WikiMasters",
};

const LEADING_SYMBOLS_PATTERN = /^[^\p{L}\p{N}]+/u;

export function categoryOf(type: string): NotificationCategory {
	return CATEGORY_PREFIXES.find(([prefix]) => type.startsWith(prefix))?.[1] ?? "other";
}

function readText(value: unknown): string {
	return typeof value === "string" ? value.replace(LEADING_SYMBOLS_PATTERN, "").trim() : "";
}

function readId(data: Record<string, unknown>, key: string): string | null {
	const value = data[key];
	return typeof value === "string" && value.length > 0 ? encodeURIComponent(value) : null;
}

function pathFor(category: NotificationCategory, data: Record<string, unknown>): string {
	const auctionId = readId(data, "auction_id");
	const battleId = readId(data, "battle_id");
	if (auctionId) return `/marketplace/${auctionId}`;
	if (battleId) return `/battle/duels/${battleId}`;
	if (category === "trades") return "/trades";
	if (category === "friends") return "/friends";
	return "/";
}

function readNotification(entry: unknown): SiteNotification | null {
	if (!isRecord(entry)) return null;
	const { id, type, created_at: createdAtText, read } = entry;
	const createdAt = typeof createdAtText === "string" ? Date.parse(createdAtText) : Number.NaN;
	if (typeof id !== "string" || typeof type !== "string" || !Number.isFinite(createdAt)) return null;
	const data = isRecord(entry.data) ? entry.data : {};
	const category = categoryOf(type);
	return {
		id,
		type,
		category,
		title: readText(data.title) || CATEGORY_TITLES[category],
		message: readText(data.message),
		createdAt,
		read: read === true,
		path: pathFor(category, data),
	};
}

export function parseNotifications(json: unknown): SiteNotification[] {
	const entries = isRecord(json) && Array.isArray(json.notifications) ? json.notifications : [];
	return entries
		.map(readNotification)
		.filter((notification): notification is SiteNotification => notification !== null);
}

export function unseenNotifications(notifications: readonly SiteNotification[], seenUntil: number): SiteNotification[] {
	return notifications
		.filter((notification) => !notification.read && notification.createdAt > seenUntil)
		.sort((left, right) => left.createdAt - right.createdAt);
}

export function latestCreatedAt(notifications: readonly SiteNotification[], fallback: number): number {
	return notifications.reduce((latest, notification) => Math.max(latest, notification.createdAt), fallback);
}
