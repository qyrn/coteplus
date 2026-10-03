import { describe, expect, it } from "vitest";
import { findTileSellerName, profilePath } from "./player-profile-links";

describe("findTileSellerName", () => {
	it("finds the text node holding the seller name", () => {
		const tile = document.createElement("div");
		const line = document.createElement("p");
		line.append(document.createTextNode("Vendu par "), document.createTextNode("bigbig1312"));
		tile.append(line);
		expect(findTileSellerName(tile)?.data).toBe("bigbig1312");
	});

	it("returns null without a seller line", () => {
		document.body.innerHTML = "<div><p>Mise de départ</p></div>";
		expect(findTileSellerName(document.body)).toBeNull();
	});
});

describe("profilePath", () => {
	it("encodes the username", () => {
		expect(profilePath("L-théanine")).toBe("/profile/L-th%C3%A9anine");
	});
});
