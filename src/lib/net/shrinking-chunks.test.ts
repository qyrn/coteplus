import { describe, expect, it, vi } from "vitest";
import { runInShrinkingChunks } from "./shrinking-chunks";
import { SupabaseRequestError } from "./supabase-request-error";

const timeout = new SupabaseRequestError(500, "57014");

describe("runInShrinkingChunks", () => {
	it("sends the items in chunks of the given size", async () => {
		const task = vi.fn(async () => {});
		await runInShrinkingChunks([1, 2, 3, 4, 5], 2, task);
		expect(task.mock.calls).toEqual([[[1, 2]], [[3, 4]], [[5]]]);
	});

	it("splits a chunk in half when the database times out", async () => {
		const sent: number[][] = [];
		const task = vi.fn(async (chunk: readonly number[]) => {
			if (chunk.length > 2) throw timeout;
			sent.push([...chunk]);
		});
		await runInShrinkingChunks([1, 2, 3, 4, 5], 5, task);
		expect(sent).toEqual([[1, 2], [3], [4, 5]]);
	});

	it("gives up on a single item that still times out", async () => {
		const task = vi.fn(async () => {
			throw timeout;
		});
		await expect(runInShrinkingChunks([1], 5, task)).rejects.toBe(timeout);
	});

	it("never splits on another error", async () => {
		const refused = new SupabaseRequestError(403, "42501");
		const task = vi.fn(async () => {
			throw refused;
		});
		await expect(runInShrinkingChunks([1, 2, 3], 5, task)).rejects.toBe(refused);
		expect(task).toHaveBeenCalledTimes(1);
	});
});
