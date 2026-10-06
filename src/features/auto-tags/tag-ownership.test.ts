import { describe, expect, it } from "vitest";
import { extensionTags } from "./tag-ownership";

describe("extensionTags", () => {
	it("keeps only tags matching an auto tag by name and color", () => {
		const tags = [
			{ id: "auto", name: "doublon ", color: "#38BDF8" },
			{ id: "recolored", name: "À vendre", color: "#fb923c" },
			{ id: "mine", name: "Favorites", color: "#38bdf8" },
			{ id: "discard", name: "À défausser", color: "#f87171" },
		];
		expect(extensionTags(tags).map((tag) => tag.id)).toEqual(["auto", "discard"]);
	});
});
