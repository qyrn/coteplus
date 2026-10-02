import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	outDir: "dist",
	manifestVersion: 3,
	manifest: ({ browser }) => ({
		name: "WikiMasters Plus",
		description: "Prix moyens et outils de collection pour WikiMasters, en lecture seule.",
		host_permissions: ["https://www.wiki-masters.com/*"],
		permissions: ["storage", "alarms", "notifications"],
		action: { default_title: "WikiMasters Plus" },
		...(browser === "firefox"
			? {
					browser_specific_settings: {
						gecko: {
							id: "wikimasters-plus@extension",
							data_collection_permissions: { required: ["none"] },
						},
					},
				}
			: {}),
	}),
});
