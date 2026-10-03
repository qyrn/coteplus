import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { createTtlStore } from "./ttl-store";

describe("createTtlStore", () => {
	beforeEach(() => fakeBrowser.reset());

	it("reads several stored values at once from a fresh store", async () => {
		await createTtlStore<number>("test").setMany(
			[
				["a", 1],
				["b", 2],
			],
			60_000,
		);
		const found = await createTtlStore<number>("test").getMany(["a", "b", "missing"]);
		expect([...found.entries()].map(([id, cached]) => [id, cached.value])).toEqual([
			["a", 1],
			["b", 2],
		]);
	});

	it("ignores expired values", async () => {
		const store = createTtlStore<number>("test");
		await store.set("old", 1, -1);
		expect(await store.get("old")).toBeNull();
		expect((await store.getMany(["old"])).size).toBe(0);
	});
});
