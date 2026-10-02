import { describe, expect, it } from "vitest";
import { commonsFileUrl, findFreeImage, parseWikipediaPageImage, pickWikidataImageFile } from "./wikimedia-image";

describe("parseWikipediaPageImage", () => {
	it("reads the thumbnail and the Wikidata id", () => {
		const json = {
			query: {
				pages: [{ thumbnail: { source: "https://upload.wikimedia.org/a.jpg" }, pageprops: { wikibase_item: "Q42" } }],
			},
		};
		expect(parseWikipediaPageImage(json)).toEqual({
			thumbnailUrl: "https://upload.wikimedia.org/a.jpg",
			wikidataId: "Q42",
		});
	});

	it("rejects unsafe values", () => {
		const json = {
			query: { pages: [{ thumbnail: { source: "javascript:alert(1)" }, pageprops: { wikibase_item: "x" } }] },
		};
		expect(parseWikipediaPageImage(json)).toEqual({ thumbnailUrl: null, wikidataId: null });
	});
});

describe("pickWikidataImageFile", () => {
	it("prefers the main image, then logo and other properties", () => {
		const claim = (value: string) => [{ mainsnak: { datavalue: { value } } }];
		const json = { entities: { Q1: { claims: { P154: claim("Logo.svg"), P242: claim("Map.png") } } } };
		expect(pickWikidataImageFile(json, "Q1")).toBe("Logo.svg");
	});

	it("returns null without image claims", () => {
		expect(pickWikidataImageFile({ entities: { Q1: { claims: {} } } }, "Q1")).toBeNull();
	});
});

describe("commonsFileUrl", () => {
	it("builds a resized Commons file URL", () => {
		expect(commonsFileUrl("Tour Eiffel.jpg")).toBe(
			"https://commons.wikimedia.org/wiki/Special:FilePath/Tour_Eiffel.jpg?width=480",
		);
	});
});

describe("findFreeImage", () => {
	it("falls back to Wikidata when Wikipedia has no free image", async () => {
		const responses = new Map<string, unknown>([
			["fr.wikipedia.org", { query: { pages: [{ pageprops: { wikibase_item: "Q90" } }] } }],
			[
				"www.wikidata.org",
				{ entities: { Q90: { claims: { P18: [{ mainsnak: { datavalue: { value: "Paris.jpg" } } }] } } } },
			],
		]);
		const queue = { getJson: async (url: string) => responses.get(new URL(url).hostname) };
		expect(await findFreeImage("Paris", queue)).toBe(
			"https://commons.wikimedia.org/wiki/Special:FilePath/Paris.jpg?width=480",
		);
	});
});
