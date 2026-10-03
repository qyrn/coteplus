import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
	createGuardedSiteFetcher,
	isAutomationBlock,
	SiteApiPausedError,
	siteApiPausedUntilItem,
} from "./site-api-guard";

const blockedBody = { error: "Trop de requêtes automatisées.", code: "automation_limit" };

describe("isAutomationBlock", () => {
	it("recognizes the anti-automation answer", () => {
		expect(isAutomationBlock(403, blockedBody)).toBe(true);
		expect(isAutomationBlock(403, { error: "interdit" })).toBe(false);
		expect(isAutomationBlock(429, blockedBody)).toBe(false);
	});
});

describe("createGuardedSiteFetcher", () => {
	beforeEach(() => fakeBrowser.reset());
	afterEach(() => vi.unstubAllGlobals());

	it("pauses every request after an anti-automation answer", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(blockedBody), { status: 403 }));
		vi.stubGlobal("fetch", fetchMock);
		const guardedFetch = createGuardedSiteFetcher("https://www.wiki-masters.com");
		await expect(guardedFetch("/api/cards")).rejects.toBeInstanceOf(SiteApiPausedError);
		expect(await siteApiPausedUntilItem.getValue()).toBeGreaterThan(Date.now());
		await expect(guardedFetch("/api/cards")).rejects.toBeInstanceOf(SiteApiPausedError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("lets normal answers through", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 200 })),
		);
		const response = await createGuardedSiteFetcher("https://www.wiki-masters.com")("/api/cards");
		expect(response.status).toBe(200);
	});
});
