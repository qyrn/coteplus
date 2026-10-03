import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const ICON_SOURCES = [
	{ source: "assets/logo/logo-small.svg", sizes: [16, 32] },
	{ source: "assets/logo/logo.svg", sizes: [48, 128] },
];

for (const { source, sizes } of ICON_SOURCES) {
	const svg = await readFile(source, "utf8");
	for (const size of sizes) {
		const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
		await writeFile(`public/icon/${size}.png`, png);
	}
}
