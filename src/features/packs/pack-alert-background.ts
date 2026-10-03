import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import { openSitePage } from "../../lib/browser/open-site-page";
import { isQuietTime, loadSettings } from "../settings/settings";
import { isPackStockMessage, type PackStockMessage } from "./pack-messages";
import { estimateStock, fullStockAt, nextStockChangeAt, type PackStockState, stateFromReading } from "./pack-stock";
import { packStockItem, readPackStockState } from "./pack-stock-store";

const TICK_ALARM = "pack-stock-tick";
const FULL_ALARM = "pack-stock-full";
const FULL_NOTIFICATION_ID = "pack-stock-full";
const LATE_NOTIFICATION_THRESHOLD_MS = 60 * 1000;
const BADGE_FULL_COLOR = "#34d399";
const BADGE_PARTIAL_COLOR = "#3f4642";
const BADGE_UNKNOWN_COLOR = "#2e3431";

const notifiedFullAtItem = storage.defineItem<number | null>("local:pack-stock-notified-full-at", { fallback: null });

const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

async function scheduleAlarm(name: string, when: number | null): Promise<void> {
	await browser.alarms.clear(name);
	if (when !== null && when > Date.now()) await browser.alarms.create(name, { when });
}

async function showBadge(text: string, color: string): Promise<void> {
	await browser.action.setBadgeText({ text });
	await browser.action.setBadgeBackgroundColor({ color });
	await browser.action.setBadgeTextColor({ color: "#ffffff" });
}

async function refresh(): Promise<void> {
	const state = await readPackStockState();
	const now = Date.now();
	if (!state) {
		await showBadge("?", BADGE_UNKNOWN_COLOR);
		await Promise.all([scheduleAlarm(TICK_ALARM, null), scheduleAlarm(FULL_ALARM, null)]);
		return;
	}
	const estimated = estimateStock(state, now);
	await showBadge(String(estimated), estimated >= state.maxStock ? BADGE_FULL_COLOR : BADGE_PARTIAL_COLOR);
	await Promise.all([
		scheduleAlarm(TICK_ALARM, nextStockChangeAt(state, now)),
		scheduleAlarm(FULL_ALARM, fullStockAt(state)),
	]);
}

function fullStockMessage(state: PackStockState, fullAt: number, now: number): string {
	const waiting = `${state.maxStock} paquets t'attendent. La régénération est en pause tant que tu n'en ouvres pas.`;
	if (now - fullAt < LATE_NOTIFICATION_THRESHOLD_MS) return waiting;
	return `Stock plein depuis ${timeFormatter.format(fullAt)} environ. ${waiting}`;
}

async function notifyIfFull(): Promise<void> {
	const state = await readPackStockState();
	const fullAt = state ? fullStockAt(state) : null;
	const now = Date.now();
	if (!state || fullAt === null || now < fullAt || (await notifiedFullAtItem.getValue()) === fullAt) return;
	await notifiedFullAtItem.setValue(fullAt);
	const settings = await loadSettings();
	if (!settings.packFullNotification || isQuietTime(settings.quietHours, new Date(now))) return;
	await browser.notifications.create(FULL_NOTIFICATION_ID, {
		type: "basic",
		iconUrl: browser.runtime.getURL("/icon/128.png"),
		title: "Stock de paquets plein",
		message: fullStockMessage(state, fullAt, now),
	});
}

async function handleMessage(message: PackStockMessage): Promise<void> {
	if (message.type === "pack-stock/signed-out") {
		await packStockItem.setValue(null);
	} else {
		await packStockItem.setValue(stateFromReading(message.reading, message.readAt));
	}
	await refresh();
}

async function refreshAndNotify(): Promise<void> {
	await refresh();
	await notifyIfFull();
}

export function startPackAlert(): void {
	browser.runtime.onMessage.addListener((message: unknown) => {
		if (isPackStockMessage(message)) void handleMessage(message);
	});
	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === TICK_ALARM || alarm.name === FULL_ALARM) void refreshAndNotify();
	});
	browser.notifications.onClicked.addListener((notificationId) => {
		if (notificationId !== FULL_NOTIFICATION_ID) return;
		void browser.notifications.clear(notificationId);
		void openSitePage("/pulls");
	});
	browser.runtime.onStartup.addListener(() => void refreshAndNotify());
	browser.runtime.onInstalled.addListener(() => void refreshAndNotify());
}
