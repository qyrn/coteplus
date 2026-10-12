import { isRecord } from "../json";
import { retryStatementTimeouts } from "./statement-timeout-retry";
import { isStatementTimeout } from "./supabase-request-error";

export type FetchPageAfter = (pageSize: number, afterId: string | null) => Promise<unknown[]>;

const FIRST_PAGE_SIZE = 1000;
const MIN_PAGE_SIZE = 50;

function readRowId(row: unknown): string | null {
	return isRecord(row) && typeof row.id === "string" ? row.id : null;
}

export async function readAllAfterLastId(fetchPage: FetchPageAfter): Promise<unknown[]> {
	const rows: unknown[] = [];
	let pageSize = FIRST_PAGE_SIZE;
	let afterId: string | null = null;
	for (;;) {
		const fetchCurrentPage = (): Promise<unknown[]> => fetchPage(pageSize, afterId);
		let page: unknown[];
		try {
			page = pageSize > MIN_PAGE_SIZE ? await fetchCurrentPage() : await retryStatementTimeouts(fetchCurrentPage);
		} catch (error) {
			if (!isStatementTimeout(error) || pageSize <= MIN_PAGE_SIZE) throw error;
			pageSize = Math.max(MIN_PAGE_SIZE, Math.ceil(pageSize / 2));
			continue;
		}
		rows.push(...page);
		const lastId = readRowId(page.at(-1));
		if (page.length < pageSize || !lastId) return rows;
		afterId = lastId;
	}
}
