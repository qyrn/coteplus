import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { DEFAULT_SETTINGS, loadSettings, readSettings, type Settings, settingsItem } from "./settings";

export interface LiveSettings {
	current(): Settings;
}

export function watchLiveSettings(ctx: ContentScriptContext): LiveSettings {
	let current = DEFAULT_SETTINGS;
	void loadSettings().then((settings) => {
		current = settings;
	});
	ctx.onInvalidated(
		settingsItem.watch((value) => {
			current = readSettings(value);
		}),
	);
	return { current: () => current };
}
