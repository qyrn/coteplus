import { describe, expect, it, vi } from "vitest";
import { retryUnprocessedResponses } from "./transient-retry";

function response(status: number, headers: Record<string, string> = {}): Response {
	return new Response(null, { status, headers });
}

function options() {
	return { maxRetries: 2, baseBackoffMs: 10, sleep: vi.fn(async () => {}) };
}

describe("retryUnprocessedResponses", () => {
	it("retries a 503 with exponential backoff then returns the success", async () => {
		const send = vi
			.fn<() => Promise<Response>>()
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(response(200));
		const retry = options();
		const result = await retryUnprocessedResponses(send, retry);
		expect(result.status).toBe(200);
		expect(retry.sleep.mock.calls).toEqual([[10], [20]]);
	});

	it("waits for Retry-After on 429", async () => {
		const send = vi
			.fn<() => Promise<Response>>()
			.mockResolvedValueOnce(response(429, { "Retry-After": "2" }))
			.mockResolvedValueOnce(response(201));
		const retry = options();
		await retryUnprocessedResponses(send, retry);
		expect(retry.sleep).toHaveBeenCalledWith(2000);
	});

	it("returns the last busy response once retries are exhausted", async () => {
		const send = vi.fn(async () => response(503));
		const result = await retryUnprocessedResponses(send, options());
		expect(result.status).toBe(503);
		expect(send).toHaveBeenCalledTimes(3);
	});

	it("never retries a status the server may have processed", async () => {
		const send = vi.fn(async () => response(500));
		const result = await retryUnprocessedResponses(send, options());
		expect(result.status).toBe(500);
		expect(send).toHaveBeenCalledTimes(1);
	});
});
