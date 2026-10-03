import { describe, expect, it, vi } from "vitest";
import { createRequestQueue, HttpError, SkippedRequestError } from "./request-queue";

function jsonResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers });
}

function baseOptions(fetcher: (url: string) => Promise<Response>) {
	return {
		concurrency: 2,
		minIntervalMs: 0,
		maxRetries: 2,
		baseBackoffMs: 10,
		fetcher,
		sleep: vi.fn(async () => {}),
	};
}

describe("createRequestQueue", () => {
	it("never runs more requests than the concurrency limit", async () => {
		let active = 0;
		let peak = 0;
		const fetcher = async () => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active--;
			return jsonResponse(200, { ok: true });
		};
		const queue = createRequestQueue(baseOptions(fetcher));
		await Promise.all(Array.from({ length: 6 }, (_, index) => queue.getJson(`/r/${index}`)));
		expect(peak).toBe(2);
	});

	it("retries a server error then resolves", async () => {
		const fetcher = vi
			.fn<(url: string) => Promise<Response>>()
			.mockResolvedValueOnce(jsonResponse(503))
			.mockResolvedValueOnce(jsonResponse(200, { value: 1 }));
		const options = baseOptions(fetcher);
		await expect(createRequestQueue(options).getJson("/x")).resolves.toEqual({
			value: 1,
		});
		expect(options.sleep).toHaveBeenCalledWith(10);
	});

	it("waits for Retry-After on 429", async () => {
		const fetcher = vi
			.fn<(url: string) => Promise<Response>>()
			.mockResolvedValueOnce(jsonResponse(429, {}, { "Retry-After": "3" }))
			.mockResolvedValueOnce(jsonResponse(200, {}));
		const options = baseOptions(fetcher);
		await createRequestQueue(options).getJson("/x");
		expect(options.sleep).toHaveBeenCalledWith(3000);
	});

	it("does not retry a client error", async () => {
		const fetcher = vi.fn(async () => jsonResponse(404));
		await expect(createRequestQueue(baseOptions(fetcher)).getJson("/x")).rejects.toBeInstanceOf(HttpError);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("gives up after the retry budget", async () => {
		const fetcher = vi.fn(async () => jsonResponse(500));
		await expect(createRequestQueue(baseOptions(fetcher)).getJson("/x")).rejects.toMatchObject({ status: 500 });
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});

describe("request priority", () => {
	it("serves visible requests before background ones", async () => {
		const order: string[] = [];
		const fetcher = async (url: string) => {
			order.push(url);
			return jsonResponse(200, {});
		};
		const queue = createRequestQueue({
			...baseOptions(fetcher),
			concurrency: 1,
		});
		const first = queue.getJson("/first");
		const background = queue.getJson("/background", "background");
		const visible = queue.getJson("/visible");
		await Promise.all([first, background, visible]);
		expect(order).toEqual(["/first", "/visible", "/background"]);
	});
});

describe("per-minute cap", () => {
	it("waits for the window to slide once the cap is reached", async () => {
		let clock = 0;
		const sleeps: number[] = [];
		const queue = createRequestQueue({
			concurrency: 5,
			minIntervalMs: 0,
			maxPerMinute: 2,
			maxRetries: 0,
			baseBackoffMs: 0,
			fetcher: async () => jsonResponse(200, {}),
			now: () => clock,
			sleep: async (durationMs) => {
				sleeps.push(durationMs);
				clock += durationMs;
			},
		});
		await Promise.all([queue.getJson("/a"), queue.getJson("/b"), queue.getJson("/c")]);
		expect(sleeps).toEqual([60_000]);
	});

	it("drops a queued request that is no longer wanted", async () => {
		const fetcher = vi.fn(async () => jsonResponse(200, {}));
		const queue = createRequestQueue({ ...baseOptions(fetcher), concurrency: 1 });
		let wanted = true;
		const first = queue.getJson("/first");
		const second = queue.getJson("/second", "visible", () => wanted);
		wanted = false;
		await first;
		await expect(second).rejects.toBeInstanceOf(SkippedRequestError);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
