import { describe, expect, it } from "vitest";
import { categoryGroupOf } from "./category-groups";

function groupName(category: string): string | null {
	return categoryGroupOf(category)?.name ?? null;
}

describe("categoryGroupOf", () => {
	it("sorts real site descriptions into precise groups", () => {
		expect(groupName("actrice française")).toBe("Acteurs & actrices");
		expect(groupName("footballeur maltais")).toBe("Footballeurs");
		expect(groupName("joueur australien de hockey sur gazon")).toBe("Sportifs");
		expect(groupName("chanson de Serge Gainsbourg")).toBe("Albums & chansons");
		expect(groupName("commune française du département de l'Ain")).toBe("Communes & villages");
		expect(groupName("espèce de plantes")).toBe("Plantes & champignons");
		expect(groupName("espèce d'insectes")).toBe("Insectes & araignées");
		expect(groupName("astéroïde de la ceinture principale")).toBe("Espace");
		expect(groupName("page d'homonymie d'un projet Wikimédia")).toBe("Homonymie");
		expect(groupName("compétition de hockey sur glace")).toBe("Clubs & compétitions");
	});

	it("follows the head noun, the first word that names a group", () => {
		expect(groupName("réalisateur de films américain")).toBe("Cinéastes");
		expect(groupName("église de la commune de Brest")).toBe("Bâtiments & monuments");
		expect(groupName("maire de la ville de Lyon")).toBe("Politique");
		expect(groupName("chanson du film Titanic")).toBe("Albums & chansons");
	});

	it("breaks ties on the same word with the more specific group", () => {
		expect(groupName("homme politique français")).toBe("Politique");
		expect(groupName("homme d'affaires suisse")).toBe("Personnalités");
		expect(groupName("joueur de football français")).toBe("Footballeurs");
		expect(groupName("saison 2 de la série télévisée")).toBe("Films & séries");
		expect(groupName("série de bande dessinée")).toBe("Livres & BD");
		expect(groupName("auteur-compositeur-interprète français")).toBe("Musiciens");
	});

	it("does not mistake look-alike words", () => {
		expect(groupName("jeune pousse portugaise")).toBeNull();
		expect(groupName("animation japonaise")).toBeNull();
		expect(groupName("Jeux olympiques d'été de 1924")).toBe("Clubs & compétitions");
	});

	it("handles plurals and empty categories", () => {
		expect(groupName("liste de films")).toBe("Listes");
		expect(groupName("jeux vidéo de rôle")).toBe("Jeux");
		expect(groupName("")).toBeNull();
	});
});
