export class SupabaseRequestError extends Error {
	override name = "SupabaseRequestError";

	constructor(
		readonly status: number,
		readonly code: string | null,
	) {
		super(`Supabase a répondu ${status}${code ? `, code ${code}` : ""}`);
	}
}

const STATEMENT_TIMEOUT_CODE = "57014";

export function isStatementTimeout(error: unknown): boolean {
	return error instanceof SupabaseRequestError && error.code === STATEMENT_TIMEOUT_CODE;
}
