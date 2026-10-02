import { browser } from "wxt/browser";

export const SITE_ORIGIN = "https://www.wiki-masters.com";

export async function openSitePage(path: string): Promise<void> {
	const url = `${SITE_ORIGIN}${path}`;
	const siteTabs = await browser.tabs.query({ url: `${SITE_ORIGIN}/*` });
	const target = siteTabs.find((tab) => tab.url === url) ?? siteTabs[0];
	if (target?.id === undefined) {
		await browser.tabs.create({ url });
		return;
	}
	await browser.tabs.update(target.id, target.url === url ? { active: true } : { active: true, url });
	if (target.windowId !== undefined) await browser.windows.update(target.windowId, { focused: true });
}
