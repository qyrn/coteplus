import { describe, expect, it } from "vitest";
import { categoryGroupOf } from "./category-groups";

function groupName(category: string): string | null {
	return categoryGroupOf(category)?.name ?? null;
}

describe("categoryGroupOf", () => {
	it("sorts real site descriptions into broad groups", () => {
		expect(groupName("actrice française")).toBe("Personnes");
		expect(groupName("footballeur maltais")).toBe("Personnes");
		expect(groupName("chanson de Serge Gainsbourg")).toBe("Œuvres");
		expect(groupName("album de Serge Gainsbourg, sorti en 1971")).toBe("Œuvres");
		expect(groupName("commune française du département de l'Ain")).toBe("Lieux");
		expect(groupName("espèce de plantes")).toBe("Nature");
		expect(groupName("astéroïde de la ceinture principale")).toBe("Espace");
		expect(groupName("page d'homonymie d'un projet Wikimédia")).toBe("Homonymie");
		expect(groupName("compétition de hockey sur glace")).toBe("Sport");
	});

	it("prefers the person over the work they made", () => {
		expect(groupName("réalisateur de films américain")).toBe("Personnes");
	});

	it("does not mistake look-alike words", () => {
		expect(groupName("jeune pousse portugaise")).toBeNull();
		expect(groupName("animation japonaise")).toBeNull();
	});

	it("handles plurals and empty categories", () => {
		expect(groupName("liste de films")).toBe("Œuvres");
		expect(groupName("")).toBeNull();
	});
});
