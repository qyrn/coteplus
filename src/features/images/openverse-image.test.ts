import { describe, expect, it } from "vitest";
import { findOpenverseImage, matchKey, personName, pickOpenverseImage } from "./openverse-image";

function result(overrides: Record<string, unknown>) {
	return {
		title: "Benjamin Castaldi",
		url: "https://live.staticflickr.com/1/photo.jpg",
		thumbnail: "https://api.openverse.org/v1/images/abc/thumb/",
		creator: "Cocobia",
		license: "by",
		license_version: "2.0",
		source: "flickr",
		...overrides,
	};
}

describe("personName", () => {
	it("drops the disambiguation in parentheses", () => {
		expect(personName("Bambou (chanteuse)")).toBe("Bambou");
	});
});

describe("matchKey", () => {
	it("ignores accents, case, spaces and punctuation", () => {
		expect(matchKey("BenjaminCastaldi(animateur)")).toContain(matchKey("Benjamin Castaldi"));
		expect(matchKey("Éric")).toBe("eric");
	});
});

describe("pickOpenverseImage", () => {
	it("keeps only results naming the card", () => {
		const json = { results: [result({ title: "Concert à Paris" })] };
		expect(pickOpenverseImage(json, "Benjamin Castaldi")).toBeNull();
	});

	it("prefers Wikimedia, then the shortest title", () => {
		const json = {
			results: [
				result({ title: "Benjamin Castaldi sur un plateau télé en 2012" }),
				result({ title: "Benjamin Castaldi" }),
				result({
					title: "BenjaminCastaldi(animateur)",
					source: "wikimedia",
					license: "cc0",
					license_version: "1.0",
					url: "https://upload.wikimedia.org/wikipedia/commons/9/91/BenjaminCastaldi%28animateur%29.png",
				}),
			],
		};
		expect(pickOpenverseImage(json, "Benjamin Castaldi")).toEqual({
			url: "https://commons.wikimedia.org/wiki/Special:FilePath/BenjaminCastaldi(animateur).png?width=480",
			credit: "Photo : Cocobia, licence CC0 1.0, via Openverse",
		});
	});

	it("uses the Openverse thumbnail outside Wikimedia", () => {
		const json = { results: [result({})] };
		expect(pickOpenverseImage(json, "Benjamin Castaldi")?.url).toBe("https://api.openverse.org/v1/images/abc/thumb/");
	});

	it("rejects no-derivatives licenses", () => {
		const json = { results: [result({ license: "by-nc-nd" })] };
		expect(pickOpenverseImage(json, "Benjamin Castaldi")).toBeNull();
	});
});

describe("findOpenverseImage", () => {
	it("skips single word names to avoid unrelated pictures", async () => {
		const queue = {
			getJson: async () => {
				throw new Error("should not be called");
			},
		};
		expect(await findOpenverseImage("Bambou (chanteuse)", queue)).toBeNull();
	});
});
