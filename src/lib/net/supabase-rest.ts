import { isRecord } from "../json";
import { findSupabasePublicKey } from "../site/supabase-public-key";
import { parseSupabaseSession } from "../site/supabase-session";
import { readAllAfterLastId } from "./keyset-pages";
import { SupabaseRequestError } from "./supabase-request-error";
import { retryTransientFailures } from "./transient-retry";

export interface InsertOptions {
	onConflict?: string;
	returnRows?: boolean;
}

export interface SupabaseRest {
	userId: string;
	getAll(path: string): Promise<unknown[]>;
	insert(table: string, rows: readonly object[], options?: InsertOptions): Promise<unknown[]>;
	deleteRows(path: string): Promise<void>;
	rpc(functionName: string, args: object): Promise<void>;
}

export class SupabaseSessionError extends Error {
	override name = "SupabaseSessionError";
}

const MIN_SESSION_LIFETIME_MS = 60 * 1000;
const BUSY_RETRY = { maxRetries: 4, baseBackoffMs: 1000 };
const REQUEST_TIMEOUT_MS = 60 * 1000;

async function readErrorCode(response: Response): Promise<string | null> {
	try {
		const body: unknown = await response.json();
		return isRecord(body) && typeof body.code === "string" ? body.code : null;
	} catch {
		return null;
	}
}

export async function connectSupabase(): Promise<SupabaseRest> {
	const session = parseSupabaseSession(document.cookie);
	if (!session || session.expiresAt - Date.now() < MIN_SESSION_LIFETIME_MS) {
		throw new SupabaseSessionError("Session introuvable ou expirée");
	}
	const publicKey = await findSupabasePublicKey(session.projectRef);
	if (!publicKey) throw new SupabaseSessionError("Clé publique du site introuvable");
	const baseUrl = `https://${session.projectRef}.supabase.co/rest/v1/`;
	const authHeaders = { apikey: publicKey, Authorization: `Bearer ${session.accessToken}` };

	async function send(path: string, init: RequestInit, repeatable: boolean): Promise<Response> {
		const response = await retryTransientFailures(
			() =>
				fetch(baseUrl + path, {
					...init,
					credentials: "omit",
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
					headers: { ...authHeaders, ...init.headers },
				}),
			{ ...BUSY_RETRY, repeatable },
		);
		if (response.status === 401) throw new SupabaseSessionError("Session refusée par le site");
		if (!response.ok) throw new SupabaseRequestError(response.status, await readErrorCode(response));
		return response;
	}

	async function readRows(response: Response): Promise<unknown[]> {
		const json: unknown = await response.json();
		return Array.isArray(json) ? json : [];
	}

	return {
		userId: session.userId,
		getAll(path) {
			return readAllAfterLastId(async (pageSize, afterId) => {
				const cursor = afterId ? `&id=gt.${encodeURIComponent(afterId)}` : "";
				return readRows(await send(`${path}&order=id&limit=${pageSize}${cursor}`, {}, true));
			});
		},
		async insert(table, rows, options = {}) {
			const preferences = [options.returnRows ? "return=representation" : "return=minimal"];
			if (options.onConflict) preferences.push("resolution=ignore-duplicates");
			const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
			const response = await send(
				`${table}${query}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Prefer: preferences.join(",") },
					body: JSON.stringify(rows),
				},
				options.onConflict !== undefined,
			);
			return options.returnRows ? readRows(response) : [];
		},
		async deleteRows(path) {
			await send(path, { method: "DELETE", headers: { Prefer: "return=minimal" } }, true);
		},
		async rpc(functionName, args) {
			await send(
				`rpc/${functionName}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(args),
				},
				true,
			);
		},
	};
}
