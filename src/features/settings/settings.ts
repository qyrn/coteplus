import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";

export interface QuietHours {
	enabled: boolean;
	startMinute: number;
	endMinute: number;
}

export interface Settings {
	wishlistRedirect: boolean;
	greatDealPercent: number;
	reminderLeadMinutes: number;
	standingNotification: boolean;
	packFullNotification: boolean;
	quietHours: QuietHours;
	discardGuardMinPrice: number;
}

export interface NumberRange {
	min: number;
	max: number;
}

const MINUTES_PER_DAY = 24 * 60;

export const SETTING_RANGES = {
	greatDealPercent: { min: 5, max: 90 },
	reminderLeadMinutes: { min: 1, max: 60 },
	discardGuardMinPrice: { min: 1, max: 1_000_000 },
} satisfies Record<string, NumberRange>;

export const DEFAULT_SETTINGS: Settings = {
	wishlistRedirect: true,
	greatDealPercent: 20,
	reminderLeadMinutes: 5,
	standingNotification: true,
	packFullNotification: true,
	quietHours: { enabled: false, startMinute: 23 * 60, endMinute: 8 * 60 },
	discardGuardMinPrice: 10,
};

export const settingsItem = storage.defineItem<unknown>("local:settings", { fallback: DEFAULT_SETTINGS });

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

export function clampToRange(value: unknown, range: NumberRange, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function readMinuteOfDay(value: unknown, fallback: number): number {
	return clampToRange(value, { min: 0, max: MINUTES_PER_DAY - 1 }, fallback);
}

function readQuietHours(value: unknown): QuietHours {
	const fallback = DEFAULT_SETTINGS.quietHours;
	if (!isRecord(value)) return fallback;
	return {
		enabled: readBoolean(value.enabled, fallback.enabled),
		startMinute: readMinuteOfDay(value.startMinute, fallback.startMinute),
		endMinute: readMinuteOfDay(value.endMinute, fallback.endMinute),
	};
}

export function readSettings(value: unknown): Settings {
	const stored = isRecord(value) ? value : {};
	return {
		wishlistRedirect: readBoolean(stored.wishlistRedirect, DEFAULT_SETTINGS.wishlistRedirect),
		greatDealPercent: clampToRange(
			stored.greatDealPercent,
			SETTING_RANGES.greatDealPercent,
			DEFAULT_SETTINGS.greatDealPercent,
		),
		reminderLeadMinutes: clampToRange(
			stored.reminderLeadMinutes,
			SETTING_RANGES.reminderLeadMinutes,
			DEFAULT_SETTINGS.reminderLeadMinutes,
		),
		standingNotification: readBoolean(stored.standingNotification, DEFAULT_SETTINGS.standingNotification),
		packFullNotification: readBoolean(stored.packFullNotification, DEFAULT_SETTINGS.packFullNotification),
		quietHours: readQuietHours(stored.quietHours),
		discardGuardMinPrice: clampToRange(
			stored.discardGuardMinPrice,
			SETTING_RANGES.discardGuardMinPrice,
			DEFAULT_SETTINGS.discardGuardMinPrice,
		),
	};
}

export async function loadSettings(): Promise<Settings> {
	return readSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<void> {
	await settingsItem.setValue(readSettings(settings));
}

export function isQuietTime(quietHours: QuietHours, date: Date): boolean {
	const { enabled, startMinute, endMinute } = quietHours;
	if (!enabled || startMinute === endMinute) return false;
	const minute = date.getHours() * 60 + date.getMinutes();
	return startMinute < endMinute
		? minute >= startMinute && minute < endMinute
		: minute >= startMinute || minute < endMinute;
}
