import { describe, expect, it } from "vitest";
import { parseSupabaseSession } from "./supabase-session";

function base64Url(text: string): string {
	const bytes = new TextEncoder().encode(text);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}

const SESSION_JSON = JSON.stringify({
	access_token: "token-value",
	expires_at: 1_700_000_000,
	user: { id: "user-1", user_metadata: { name: "Maëlyne" } },
});

describe("parseSupabaseSession", () => {
	it("joins chunked base64 cookies in index order", () => {
		const encoded = `base64-${base64Url(SESSION_JSON)}`;
		const middle = Math.floor(encoded.length / 2);
		const header = `theme=dark; sb-abc123-auth-token.1=${encoded.slice(middle)}; sb-abc123-auth-token.0=${encoded.slice(0, middle)}`;
		expect(parseSupabaseSession(header)).toEqual({
			projectRef: "abc123",
			accessToken: "token-value",
			userId: "user-1",
			expiresAt: 1_700_000_000_000,
		});
	});

	it("reads a single plain JSON cookie", () => {
		const header = `sb-abc123-auth-token=${encodeURIComponent(SESSION_JSON)}`;
		expect(parseSupabaseSession(header)?.accessToken).toBe("token-value");
	});

	it("returns null without a session cookie or with a broken one", () => {
		expect(parseSupabaseSession("theme=dark")).toBeNull();
		expect(parseSupabaseSession("sb-abc123-auth-token=base64-%%%")).toBeNull();
	});
});
