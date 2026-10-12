import { describe, expect, it } from "vitest";
import { isExtensionMutation } from "./extension-mutation";
import { HIDDEN_TILE_CLASS } from "./site-tile-markers";

function element(html: string): Element {
	const template = document.createElement("template");
	template.innerHTML = html;
	const created = template.content.firstElementChild;
	if (!created) throw new Error("Empty markup");
	return created;
}

describe("isExtensionMutation", () => {
	it("ignores text rewritten inside an extension element", () => {
		const status = element(`<span class="wmp-row-muted">3 enchères masquées</span>`);
		const text = status.firstChild;
		if (!text) throw new Error("No text");
		expect(isExtensionMutation({ target: status, addedNodes: [text], removedNodes: [] })).toBe(true);
	});

	it("ignores an extension element inserted into the site", () => {
		const heading = element(`<div><h3>Paris</h3></div>`);
		const badge = element(`<span class="wmp-price-badge"></span>`);
		expect(isExtensionMutation({ target: heading, addedNodes: [badge], removedNodes: [] })).toBe(true);
	});

	it("keeps site changes, even inside a tile the extension marked", () => {
		const tile = element(`<div class="${HIDDEN_TILE_CLASS}"><h3>Paris</h3></div>`);
		const title = tile.querySelector("h3");
		if (!title) throw new Error("No title");
		expect(
			isExtensionMutation({ target: title, addedNodes: [document.createTextNode("Lyon")], removedNodes: [] }),
		).toBe(false);
		expect(isExtensionMutation({ target: tile, addedNodes: [], removedNodes: [] })).toBe(false);
	});

	it("keeps a site element added next to extension elements", () => {
		const list = element(`<ul></ul>`);
		const added = [element(`<span class="wmp-chip"></span>`), element(`<li>Site</li>`)];
		expect(isExtensionMutation({ target: list, addedNodes: added, removedNodes: [] })).toBe(false);
	});
});
