import { describe, expect, it } from "vitest";
import { readRevealPosition } from "./reveal-watcher";

describe("readRevealPosition", () => {
	it("reads the current card position", () => {
		document.body.innerHTML = "<main><div><span>Carte</span><span>3</span><span>/ 5</span></div></main>";
		expect(readRevealPosition(document)).toMatchObject({ index: 3, total: 5 });
	});

	it("returns null outside the reveal", () => {
		document.body.innerHTML = "<main><div><span>Ouvrir</span></div></main>";
		expect(readRevealPosition(document)).toBeNull();
	});
});
