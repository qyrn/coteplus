import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { isExtensionMutation } from "./extension-mutation";

export interface PageWatcher {
	subscribe(onPageChange: () => void): void;
}

export function createPageWatcher(ctx: ContentScriptContext): PageWatcher {
	const listeners: Array<() => void> = [];
	let notifyScheduled = false;

	function notify(): void {
		notifyScheduled = false;
		for (const listener of listeners) {
			try {
				listener();
			} catch (error) {
				console.error("[Cote+]", error);
			}
		}
	}

	function scheduleNotify(): void {
		if (notifyScheduled || ctx.isInvalid) return;
		notifyScheduled = true;
		ctx.requestAnimationFrame(notify);
	}

	const mutationObserver = new MutationObserver((mutations) => {
		if (!mutations.every(isExtensionMutation)) scheduleNotify();
	});
	mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
	ctx.onInvalidated(() => mutationObserver.disconnect());

	return {
		subscribe(onPageChange) {
			listeners.push(onPageChange);
			scheduleNotify();
		},
	};
}
