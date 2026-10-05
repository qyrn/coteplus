import { isRecord } from "../json";

export interface SupabaseSession {
	projectRef: string;
	accessToken: string;
	userId: string;
	expiresAt: number;
}

const AUTH_COOKIE_PATTERN = /^sb-([a-z0-9]+)-auth-token(?:\.(\d+))?$/;
const BASE64_PREFIX = "base64-";

interface CookieChunk {
	projectRef: string;
	index: number;
	value: string;
}

function readChunk(cookie: string): CookieChunk | null {
	const separator = cookie.indexOf("=");
	if (separator < 0) return null;
	const match = AUTH_COOKIE_PATTERN.exec(cookie.slice(0, separator).trim());
	if (!match?.[1]) return null;
	return { projectRef: match[1], index: Number(match[2] ?? 0), value: cookie.slice(separator + 1).trim() };
}

function decodeBase64Url(encoded: string): string {
	const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
	const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function readSessionJson(encodedText: string): unknown {
	try {
		const text = decodeURIComponent(encodedText);
		return JSON.parse(text.startsWith(BASE64_PREFIX) ? decodeBase64Url(text.slice(BASE64_PREFIX.length)) : text);
	} catch {
		return null;
	}
}

export function parseSupabaseSession(cookieHeader: string): SupabaseSession | null {
	const chunks = cookieHeader
		.split(";")
		.map(readChunk)
		.filter((chunk): chunk is CookieChunk => chunk !== null);
	const projectRef = chunks[0]?.projectRef;
	if (!projectRef) return null;
	const encodedText = chunks
		.filter((chunk) => chunk.projectRef === projectRef)
		.sort((left, right) => left.index - right.index)
		.map((chunk) => chunk.value)
		.join("");
	const session = readSessionJson(encodedText);
	if (!isRecord(session) || !isRecord(session.user)) return null;
	const { access_token: accessToken, expires_at: expiresAt } = session;
	const userId = session.user.id;
	if (typeof accessToken !== "string" || typeof expiresAt !== "number" || typeof userId !== "string") return null;
	return { projectRef, accessToken, userId, expiresAt: expiresAt * 1000 };
}
