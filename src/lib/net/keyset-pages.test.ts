import { describe, expect, it, vi } from "vitest";
import { type FetchPageAfter, readAllAfterLastId } from "./keyset-pages";
import { SupabaseRequestError } from "./supabase-request-error";

const timeout = new SupabaseRequestError(500, "57014");

function rowsFrom(start: number, count: number): { id: string }[] {
	return Array.from({ length: count }, (_, index) => ({ id: String(start + index).padStart(5, "0") }));
}

describe("readAllAfterLastId", () => {
	it("reads the next page after the last id until a short page", async () => {
		const fetchPage = vi
			.fn<FetchPageAfter>()
			.mockResolvedValueOnce(rowsFrom(0, 1000))
			.mockResolvedValueOnce(rowsFrom(1000, 3));
		const rows = await readAllAfterLastId(fetchPage);
		expect(rows).toHaveLength(1003);
		expect(fetchPage.mock.calls).toEqual([
			[1000, null],
			[1000, "00999"],
		]);
	});

	it("reports the running row count after each page", async () => {
		const fetchPage = vi
			.fn<FetchPageAfter>()
			.mockResolvedValueOnce(rowsFrom(0, 1000))
			.mockResolvedValueOnce(rowsFrom(1000, 3));
		const onRowsRead = vi.fn();
		await readAllAfterLastId(fetchPage, onRowsRead);
		expect(onRowsRead.mock.calls).toEqual([[1000], [1003]]);
	});

	it("halves the page size when the database times out, then grows it back", async () => {
		const fetchPage = vi
			.fn<FetchPageAfter>()
			.mockRejectedValueOnce(timeout)
			.mockRejectedValueOnce(timeout)
			.mockResolvedValueOnce(rowsFrom(0, 250))
			.mockResolvedValueOnce(rowsFrom(250, 500))
			.mockResolvedValueOnce(rowsFrom(750, 1000))
			.mockResolvedValueOnce(rowsFrom(1750, 10));
		const rows = await readAllAfterLastId(fetchPage);
		expect(rows).toHaveLength(1760);
		expect(fetchPage.mock.calls).toEqual([
			[1000, null],
			[500, null],
			[250, null],
			[500, "00249"],
			[1000, "00749"],
			[1000, "01749"],
		]);
	});

	it("retries the smallest page before giving up", async () => {
		vi.useFakeTimers();
		const fetchPage = vi.fn<FetchPageAfter>().mockRejectedValue(timeout);
		const result = expect(readAllAfterLastId(fetchPage)).rejects.toBe(timeout);
		await vi.runAllTimersAsync();
		await result;
		expect(fetchPage.mock.calls.slice(-4)).toEqual(Array.from({ length: 4 }, () => [50, null]));
		vi.useRealTimers();
	});

	it("never shrinks on another error", async () => {
		const refused = new SupabaseRequestError(403, "42501");
		const fetchPage = vi.fn<FetchPageAfter>().mockRejectedValue(refused);
		await expect(readAllAfterLastId(fetchPage)).rejects.toBe(refused);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});
