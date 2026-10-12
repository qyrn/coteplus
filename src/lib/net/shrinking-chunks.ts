import { retryStatementTimeouts } from "./statement-timeout-retry";
import { isStatementTimeout } from "./supabase-request-error";

async function runSplittingOnTimeout<TItem>(
	chunk: readonly TItem[],
	task: (chunk: readonly TItem[]) => Promise<void>,
): Promise<void> {
	if (chunk.length < 2) return retryStatementTimeouts(() => task(chunk));
	try {
		await task(chunk);
	} catch (error) {
		if (!isStatementTimeout(error)) throw error;
		const middle = Math.ceil(chunk.length / 2);
		await runSplittingOnTimeout(chunk.slice(0, middle), task);
		await runSplittingOnTimeout(chunk.slice(middle), task);
	}
}

export async function runInShrinkingChunks<TItem>(
	items: readonly TItem[],
	chunkSize: number,
	task: (chunk: readonly TItem[]) => Promise<void>,
): Promise<void> {
	for (let start = 0; start < items.length; start += chunkSize) {
		await runSplittingOnTimeout(items.slice(start, start + chunkSize), task);
	}
}
