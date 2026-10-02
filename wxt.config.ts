import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	outDir: "dist",
	manifest: {
		name: "WikiMasters Plus",
		description: "Prix moyens et outils de collection pour WikiMasters, en lecture seule.",
		host_permissions: ["https://www.wiki-masters.com/*"],
		permissions: ["storage"],
	},
});
