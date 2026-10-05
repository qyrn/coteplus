import { findSupabasePublicKey } from "../site/supabase-public-key";
import { parseSupabaseSession } from "../site/supabase-session";

export interface InsertOptions {
	onConflict?: string;
	returnRows?: boolean;
}

export interface SupabaseRest {
	userId: string;
	getAll(path: string): Promise<unknown[]>;
	insert(table: string, rows: readonly object[], options?: InsertOptions): Promise<unknown[]>;
	remove(pathWithQuery: string): Promise<void>;
}

export class SupabaseSessionError extends Error {
	override name = "SupabaseSessionError";
}

const PAGE_SIZE = 1000;
const PAGES_PER_WAVE = 4;
const MIN_SESSION_LIFETIME_MS = 60 * 1000;

export async function connectSupabase(): Promise<SupabaseRest> {
	const session = parseSupabaseSession(document.cookie);
	if (!session || session.expiresAt - Date.now() < MIN_SESSION_LIFETIME_MS) {
		throw new SupabaseSessionError("Session introuvable ou expirée");
	}
	const publicKey = await findSupabasePublicKey(session.projectRef);
	if (!publicKey) throw new SupabaseSessionError("Clé publique du site introuvable");
	const baseUrl = `https://${session.projectRef}.supabase.co/rest/v1/`;
	const authHeaders = { apikey: publicKey, Authorization: `Bearer ${session.accessToken}` };

	async function send(path: string, init: RequestInit): Promise<Response> {
		const response = await fetch(baseUrl + path, {
			...init,
			credentials: "omit",
			headers: { ...authHeaders, ...init.headers },
		});
		if (response.status === 401) throw new SupabaseSessionError("Session refusée par le site");
		if (!response.ok) throw new Error(`Supabase a répondu ${response.status}`);
		return response;
	}

	async function readRows(response: Response): Promise<unknown[]> {
		const json: unknown = await response.json();
		return Array.isArray(json) ? json : [];
	}

	return {
		userId: session.userId,
		async getAll(path) {
			const rows: unknown[] = [];
			for (let firstPage = 0; ; firstPage += PAGES_PER_WAVE) {
				const wave = await Promise.all(
					Array.from({ length: PAGES_PER_WAVE }, async (_, offset) => {
						const from = (firstPage + offset) * PAGE_SIZE;
						return readRows(await send(path, { headers: { Range: `${from}-${from + PAGE_SIZE - 1}` } }));
					}),
				);
				for (const page of wave) rows.push(...page);
				if (wave.some((page) => page.length < PAGE_SIZE)) return rows;
			}
		},
		async insert(table, rows, options = {}) {
			const preferences = [options.returnRows ? "return=representation" : "return=minimal"];
			if (options.onConflict) preferences.push("resolution=ignore-duplicates");
			const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
			const response = await send(`${table}${query}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Prefer: preferences.join(",") },
				body: JSON.stringify(rows),
			});
			return options.returnRows ? readRows(response) : [];
		},
		async remove(pathWithQuery) {
			await send(pathWithQuery, { method: "DELETE", headers: { Prefer: "return=minimal" } });
		},
	};
}
