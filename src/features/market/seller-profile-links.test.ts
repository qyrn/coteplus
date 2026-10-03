import { describe, expect, it } from "vitest";
import { profilePath, readTileSeller } from "./seller-profile-links";

describe("readTileSeller", () => {
	it("reads the seller name under an auction tile", () => {
		document.body.innerHTML = "<div><p>Mise de départ</p><p>Vendu par bigbig1312</p></div>";
		expect(readTileSeller(document.body)).toBe("bigbig1312");
	});

	it("returns null without a seller line", () => {
		document.body.innerHTML = "<div><p>Mise de départ</p></div>";
		expect(readTileSeller(document.body)).toBeNull();
	});
});

describe("profilePath", () => {
	it("encodes the username", () => {
		expect(profilePath("L-théanine")).toBe("/profile/L-th%C3%A9anine");
	});
});
