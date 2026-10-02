import { describe, expect, it, vi } from "vitest";
import { createRequestQueue, HttpError } from "./request-queue";

function jsonResponse(
	status: number,
	body: unknown = {},
	headers: Record<string, string> = {},
): Response {
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
		await Promise.all(
			Array.from({ length: 6 }, (_, index) => queue.getJson(`/r/${index}`)),
		);
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
		await expect(
			createRequestQueue(baseOptions(fetcher)).getJson("/x"),
		).rejects.toBeInstanceOf(HttpError);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("gives up after the retry budget", async () => {
		const fetcher = vi.fn(async () => jsonResponse(500));
		await expect(
			createRequestQueue(baseOptions(fetcher)).getJson("/x"),
		).rejects.toMatchObject({ status: 500 });
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});
