import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	outDir: "dist",
	manifestVersion: 3,
	manifest: ({ browser }) => ({
		name: "Cote+",
		description:
			"Cote des cartes, suivi des enchères et outils de collection pour WikiMasters (extension non officielle).",
		host_permissions: ["https://www.wiki-masters.com/*"],
		permissions: ["storage", "alarms", "notifications"],
		action: { default_title: "Cote+" },
		...(browser === "firefox"
			? {
					browser_specific_settings: {
						gecko: {
							id: "cote-plus@extension",
							data_collection_permissions: { required: ["none"] },
						},
					},
				}
			: {}),
	}),
});
