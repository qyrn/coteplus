import { isStatementTimeout } from "./supabase-request-error";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

function wait(durationMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export async function retryStatementTimeouts<TResult>(
	task: () => Promise<TResult>,
	sleep: (durationMs: number) => Promise<void> = wait,
): Promise<TResult> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await task();
		} catch (error) {
			if (!isStatementTimeout(error) || attempt >= MAX_RETRIES) throw error;
			await sleep(BASE_BACKOFF_MS * 2 ** attempt);
		}
	}
}
