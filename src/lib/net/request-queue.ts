export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly url: string,
	) {
		super(`HTTP ${status} on ${url}`);
		this.name = "HttpError";
	}
}

export class NonRetryableError extends Error {
	override name = "NonRetryableError";
}

export interface RequestQueueOptions {
	concurrency: number;
	minIntervalMs: number;
	maxRetries: number;
	baseBackoffMs: number;
	fetcher: (url: string) => Promise<Response>;
	sleep?: (durationMs: number) => Promise<void>;
	now?: () => number;
}

export type RequestPriority = "visible" | "background";

export interface RequestQueue {
	getJson(url: string, priority?: RequestPriority): Promise<unknown>;
}

interface PendingRequest {
	url: string;
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
}

function wait(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

function readRetryAfterMs(response: Response): number | null {
	const header = response.headers.get("Retry-After");
	if (!header) return null;
	const seconds = Number(header);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export function createRequestQueue(options: RequestQueueOptions): RequestQueue {
	const sleep = options.sleep ?? wait;
	const now = options.now ?? Date.now;
	const pendingByPriority: Record<RequestPriority, PendingRequest[]> = {
		visible: [],
		background: [],
	};
	let activeCount = 0;
	let lastStartedAt = Number.NEGATIVE_INFINITY;
	let pumpScheduled = false;

	async function fetchWithRetries(url: string): Promise<unknown> {
		for (let attempt = 0; ; attempt++) {
			let response: Response | null = null;
			try {
				response = await options.fetcher(url);
			} catch (networkError) {
				if (networkError instanceof NonRetryableError || attempt >= options.maxRetries) throw networkError;
				await sleep(options.baseBackoffMs * 2 ** attempt);
				continue;
			}
			if (response.ok) return response.json();
			if (!isRetryableStatus(response.status) || attempt >= options.maxRetries) {
				throw new HttpError(response.status, url);
			}
			await sleep(readRetryAfterMs(response) ?? options.baseBackoffMs * 2 ** attempt);
		}
	}

	function start(request: PendingRequest): void {
		activeCount++;
		lastStartedAt = now();
		fetchWithRetries(request.url)
			.then(request.resolve, request.reject)
			.finally(() => {
				activeCount--;
				pump();
			});
	}

	function takeNext(): PendingRequest | undefined {
		return pendingByPriority.visible.shift() ?? pendingByPriority.background.shift();
	}

	function hasPending(): boolean {
		return pendingByPriority.visible.length > 0 || pendingByPriority.background.length > 0;
	}

	function pump(): void {
		if (pumpScheduled) return;
		while (activeCount < options.concurrency && hasPending()) {
			const delayMs = lastStartedAt + options.minIntervalMs - now();
			if (delayMs > 0) {
				pumpScheduled = true;
				void sleep(delayMs).then(() => {
					pumpScheduled = false;
					pump();
				});
				return;
			}
			const next = takeNext();
			if (next) start(next);
		}
	}

	return {
		getJson(url, priority = "visible") {
			return new Promise((resolve, reject) => {
				pendingByPriority[priority].push({ url, resolve, reject });
				pump();
			});
		},
	};
}
