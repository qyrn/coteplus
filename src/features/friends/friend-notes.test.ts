import { describe, expect, it } from "vitest";
import { profileUsername, readFriendNotes, withNote } from "./friend-notes";

describe("withNote", () => {
	it("saves a trimmed note and removes an empty one", () => {
		const saved = withNote({}, "Élodie", "  cherche des cartes de films  ");
		expect(saved).toEqual({ Élodie: "cherche des cartes de films" });
		expect(withNote(saved, "Élodie", "   ")).toEqual({});
	});
});

describe("readFriendNotes", () => {
	it("keeps only text notes", () => {
		expect(readFriendNotes({ a: "note", b: 4, c: "" })).toEqual({ a: "note" });
		expect(readFriendNotes(null)).toEqual({});
	});
});

describe("profileUsername", () => {
	it("reads the username from a profile path", () => {
		expect(profileUsername("/profile/%C3%89lodie")).toBe("Élodie");
		expect(profileUsername("/profile")).toBeNull();
		expect(profileUsername("/profile/a/b")).toBeNull();
	});
});
