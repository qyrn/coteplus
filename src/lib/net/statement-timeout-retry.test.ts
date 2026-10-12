import { describe, expect, it, vi } from "vitest";
import { retryStatementTimeouts } from "./statement-timeout-retry";
import { SupabaseRequestError } from "./supabase-request-error";

const timeout = new SupabaseRequestError(500, "57014");
const noSleep = async (): Promise<void> => {};

describe("retryStatementTimeouts", () => {
	it("runs the task again after a statement timeout", async () => {
		const task = vi.fn<() => Promise<string>>().mockRejectedValueOnce(timeout).mockResolvedValueOnce("done");
		await expect(retryStatementTimeouts(task, noSleep)).resolves.toBe("done");
		expect(task).toHaveBeenCalledTimes(2);
	});

	it("waits longer before each new attempt", async () => {
		const sleep = vi.fn(noSleep);
		const task = vi.fn(async () => {
			throw timeout;
		});
		await expect(retryStatementTimeouts(task, sleep)).rejects.toBe(timeout);
		expect(sleep.mock.calls).toEqual([[2000], [4000], [8000]]);
		expect(task).toHaveBeenCalledTimes(4);
	});

	it("never retries another error", async () => {
		const refused = new SupabaseRequestError(403, "42501");
		const task = vi.fn(async () => {
			throw refused;
		});
		await expect(retryStatementTimeouts(task, noSleep)).rejects.toBe(refused);
		expect(task).toHaveBeenCalledTimes(1);
	});
});
