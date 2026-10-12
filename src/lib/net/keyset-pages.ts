import { isRecord } from "../json";
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
		let page: unknown[];
		try {
			page = await fetchPage(pageSize, afterId);
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
