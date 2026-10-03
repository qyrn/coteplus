import {
	loadSettings,
	readSettings,
	SETTING_RANGES,
	type Settings,
	saveSettings,
	settingsItem,
} from "../../features/settings/settings";

const SAVED_MESSAGE_MS = 2000;

function requireElement<TElement extends HTMLElement>(id: string, type: new () => TElement): TElement {
	const element = document.getElementById(id);
	if (!(element instanceof type)) throw new Error(`Élément manquant : ${id}`);
	return element;
}

const form = requireElement("settings-form", HTMLFormElement);
const saveStatus = requireElement("save-status", HTMLParagraphElement);

function input(name: string): HTMLInputElement {
	const element = form.elements.namedItem(name);
	if (!(element instanceof HTMLInputElement)) throw new Error(`Champ manquant : ${name}`);
	return element;
}

const fields = {
	wishlistRedirect: input("wishlistRedirect"),
	greatDealPercent: input("greatDealPercent"),
	reminderLeadMinutes: input("reminderLeadMinutes"),
	standingNotification: input("standingNotification"),
	packFullNotification: input("packFullNotification"),
	quietHoursEnabled: input("quietHoursEnabled"),
	quietHoursStart: input("quietHoursStart"),
	quietHoursEnd: input("quietHoursEnd"),
	discardGuardMinPrice: input("discardGuardMinPrice"),
};

let current: Settings = readSettings(null);
let savedMessageTimer: number | undefined;

function minuteToTime(minuteOfDay: number): string {
	const hours = Math.floor(minuteOfDay / 60);
	const minutes = minuteOfDay % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinute(value: string, fallback: number): number {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

function numberOr(field: HTMLInputElement, fallback: number): number {
	return Number.isFinite(field.valueAsNumber) ? field.valueAsNumber : fallback;
}

function fill(settings: Settings): void {
	fields.wishlistRedirect.checked = settings.wishlistRedirect;
	fields.greatDealPercent.value = String(settings.greatDealPercent);
	fields.reminderLeadMinutes.value = String(settings.reminderLeadMinutes);
	fields.standingNotification.checked = settings.standingNotification;
	fields.packFullNotification.checked = settings.packFullNotification;
	fields.quietHoursEnabled.checked = settings.quietHours.enabled;
	fields.quietHoursStart.value = minuteToTime(settings.quietHours.startMinute);
	fields.quietHoursEnd.value = minuteToTime(settings.quietHours.endMinute);
	fields.quietHoursStart.disabled = !settings.quietHours.enabled;
	fields.quietHoursEnd.disabled = !settings.quietHours.enabled;
	fields.discardGuardMinPrice.value = String(settings.discardGuardMinPrice);
}

function readForm(): Settings {
	return readSettings({
		wishlistRedirect: fields.wishlistRedirect.checked,
		greatDealPercent: numberOr(fields.greatDealPercent, current.greatDealPercent),
		reminderLeadMinutes: numberOr(fields.reminderLeadMinutes, current.reminderLeadMinutes),
		standingNotification: fields.standingNotification.checked,
		packFullNotification: fields.packFullNotification.checked,
		quietHours: {
			enabled: fields.quietHoursEnabled.checked,
			startMinute: timeToMinute(fields.quietHoursStart.value, current.quietHours.startMinute),
			endMinute: timeToMinute(fields.quietHoursEnd.value, current.quietHours.endMinute),
		},
		discardGuardMinPrice: numberOr(fields.discardGuardMinPrice, current.discardGuardMinPrice),
	});
}

function showSaved(): void {
	saveStatus.textContent = "Enregistré";
	window.clearTimeout(savedMessageTimer);
	savedMessageTimer = window.setTimeout(() => {
		saveStatus.textContent = "";
	}, SAVED_MESSAGE_MS);
}

async function save(): Promise<void> {
	current = readForm();
	fill(current);
	await saveSettings(current);
	showSaved();
}

for (const [name, range] of Object.entries(SETTING_RANGES)) {
	const field = input(name);
	field.min = String(range.min);
	field.max = String(range.max);
	field.step = "1";
}

form.addEventListener("change", () => void save());
form.addEventListener("submit", (event) => event.preventDefault());
settingsItem.watch((value) => {
	current = readSettings(value);
	fill(current);
});
void loadSettings().then((settings) => {
	current = settings;
	fill(settings);
});
