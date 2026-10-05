import { describe, expect, it } from "vitest";
import { extractPublicKey } from "./supabase-public-key";

describe("extractPublicKey", () => {
	it("finds the key declared next to the project URL", () => {
		const script = `let a="https://abc123.supabase.co",b="eyJhbGciOi.eyJyb2xlIjoi.c2lnbmF0dXJl";createClient(a,b)`;
		expect(extractPublicKey(script, "abc123")).toBe("eyJhbGciOi.eyJyb2xlIjoi.c2lnbmF0dXJl");
	});

	it("accepts the newer publishable key format", () => {
		const script = `createClient("https://abc123.supabase.co", "sb_publishable_AbC-123")`;
		expect(extractPublicKey(script, "abc123")).toBe("sb_publishable_AbC-123");
	});

	it("ignores scripts of another project", () => {
		const script = `createClient("https://other.supabase.co", "sb_publishable_AbC")`;
		expect(extractPublicKey(script, "abc123")).toBeNull();
	});
});
