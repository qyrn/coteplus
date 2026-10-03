import type { ContentScriptContext } from "wxt/utils/content-script-context";

export interface PageWatcher {
	subscribe(onPageChange: () => void): void;
}

export function createPageWatcher(ctx: ContentScriptContext): PageWatcher {
	const listeners: Array<() => void> = [];
	let notifyScheduled = false;

	function notify(): void {
		notifyScheduled = false;
		for (const listener of listeners) listener();
	}

	function scheduleNotify(): void {
		if (notifyScheduled || ctx.isInvalid) return;
		notifyScheduled = true;
		ctx.requestAnimationFrame(notify);
	}

	const mutationObserver = new MutationObserver(scheduleNotify);
	mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
	ctx.onInvalidated(() => mutationObserver.disconnect());

	return {
		subscribe(onPageChange) {
			listeners.push(onPageChange);
			scheduleNotify();
		},
	};
}
