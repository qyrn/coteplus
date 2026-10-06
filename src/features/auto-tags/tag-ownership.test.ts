import { describe, expect, it } from "vitest";
import { AUTO_TAGS } from "./auto-tag-rules";
import { extensionTags } from "./tag-ownership";

describe("extensionTags", () => {
	it("keeps only tags matching an auto tag by name and color", () => {
		const tags = [
			{ id: "auto", name: "doublon ", color: "#38BDF8" },
			{ id: "recolored", name: "À vendre", color: "#fb923c" },
			{ id: "mine", name: "Favorites", color: "#38bdf8" },
			{ id: "retired", name: "Personnes", color: "#f472b6" },
		];
		expect(extensionTags(tags, AUTO_TAGS).map((tag) => tag.id)).toEqual(["auto", "retired"]);
	});
});
