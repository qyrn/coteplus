import { storage } from "wxt/utils/storage";
import { isRecord } from "../json";
import { NonRetryableError } from "./request-queue";

const AUTOMATION_PAUSE_MS = 60 * 60 * 1000;
const AUTOMATION_CODE_PREFIX = "automation";

export const siteApiPausedUntilItem = storage.defineItem<number>("local:site-api-paused-until", { fallback: 0 });

export class SiteApiPausedError extends NonRetryableError {
	override name = "SiteApiPausedError";
}

export function isAutomationBlock(status: number, body: unknown): boolean {
	return (
		status === 403 && isRecord(body) && typeof body.code === "string" && body.code.startsWith(AUTOMATION_CODE_PREFIX)
	);
}

export function createGuardedSiteFetcher(origin: string): (url: string) => Promise<Response> {
	return async (url) => {
		if (Date.now() < (await siteApiPausedUntilItem.getValue())) throw new SiteApiPausedError("Requêtes en pause");
		const response = await fetch(new URL(url, origin), { credentials: "include" });
		if (response.status === 403) {
			const body: unknown = await response
				.clone()
				.json()
				.catch(() => null);
			if (isAutomationBlock(response.status, body)) {
				await siteApiPausedUntilItem.setValue(Date.now() + AUTOMATION_PAUSE_MS);
				throw new SiteApiPausedError("Le site limite les requêtes automatiques");
			}
		}
		return response;
	};
}
