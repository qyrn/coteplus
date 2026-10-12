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

	it("halves the page size and keeps it when the database times out", async () => {
		const fetchPage = vi
			.fn<FetchPageAfter>()
			.mockRejectedValueOnce(timeout)
			.mockResolvedValueOnce(rowsFrom(0, 500))
			.mockResolvedValueOnce(rowsFrom(500, 10));
		const rows = await readAllAfterLastId(fetchPage);
		expect(rows).toHaveLength(510);
		expect(fetchPage.mock.calls).toEqual([
			[1000, null],
			[500, null],
			[500, "00499"],
		]);
	});

	it("gives up once the smallest page still times out", async () => {
		const fetchPage = vi.fn<FetchPageAfter>().mockRejectedValue(timeout);
		await expect(readAllAfterLastId(fetchPage)).rejects.toBe(timeout);
		expect(fetchPage.mock.calls.at(-1)).toEqual([50, null]);
	});

	it("never shrinks on another error", async () => {
		const refused = new SupabaseRequestError(403, "42501");
		const fetchPage = vi.fn<FetchPageAfter>().mockRejectedValue(refused);
		await expect(readAllAfterLastId(fetchPage)).rejects.toBe(refused);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});
