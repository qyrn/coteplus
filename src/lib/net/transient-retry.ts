export interface TransientRetryOptions {
	maxRetries: number;
	baseBackoffMs: number;
	repeatable: boolean;
	sleep?: (durationMs: number) => Promise<void>;
}

const UNPROCESSED_STATUSES = new Set([429, 503]);

function wait(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function isNetworkFailure(error: unknown): boolean {
	return error instanceof TypeError;
}

export function readRetryAfterMs(response: Response): number | null {
	const header = response.headers.get("Retry-After");
	if (!header) return null;
	const seconds = Number(header);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export async function retryTransientFailures(
	send: () => Promise<Response>,
	options: TransientRetryOptions,
): Promise<Response> {
	const sleep = options.sleep ?? wait;
	for (let attempt = 0; ; attempt++) {
		const backoffMs = options.baseBackoffMs * 2 ** attempt;
		let response: Response;
		try {
			response = await send();
		} catch (error) {
			if (!options.repeatable || !isNetworkFailure(error) || attempt >= options.maxRetries) throw error;
			await sleep(backoffMs);
			continue;
		}
		if (!UNPROCESSED_STATUSES.has(response.status) || attempt >= options.maxRetries) return response;
		await sleep(readRetryAfterMs(response) ?? backoffMs);
	}
}
