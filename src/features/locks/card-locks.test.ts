import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { isLocked, lockedCardsItem, setLocked } from "./card-locks";

describe("card locks", () => {
	beforeEach(() => {
		fakeBrowser.reset();
	});

	it("locks and unlocks a card by title and rarity", async () => {
		await setLocked("Benjamin Castaldi", "L", true);
		expect(await isLocked("Benjamin Castaldi", "L")).toBe(true);
		expect(await isLocked("Benjamin Castaldi", "UR")).toBe(false);
		await setLocked("Benjamin Castaldi", "L", false);
		expect(await lockedCardsItem.getValue()).toEqual([]);
	});

	it("never stores the same lock twice", async () => {
		await setLocked("Agen", "UR", true);
		await setLocked("Agen", "UR", true);
		expect(await lockedCardsItem.getValue()).toEqual(["UR:Agen"]);
	});
});
