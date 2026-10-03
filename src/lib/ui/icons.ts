const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const ICON_PATHS = {
	coin: ["M7.5 8.5 9.5 15.5 12 10 14.5 15.5 16.5 8.5"],
	chevron: ["m6 9 6 6 6-6"],
	close: ["M18 6 6 18", "m6 6 12 12"],
	star: ["M12 2.5 14.94 8.46 21.5 9.41 16.75 14.04 17.87 20.58 12 17.5 6.13 20.58 7.25 14.04 2.5 9.41 9.06 8.46Z"],
	trendingUp: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
	lineChart: ["M3 3v18h18", "m19 9-5 5-4-4-3 3"],
	barChart: ["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"],
	exchange: ["m8 3-4 4 4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
	heart: [
		"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
	],
	lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 10 0v4"],
	lockOpen: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z", "M7 11V7a5 5 0 0 1 9.9-1"],
	alert: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");
	svg.classList.add("wmp-icon", `wmp-icon-${name}`);
	if (name === "coin") {
		const circle = document.createElementNS(SVG_NAMESPACE, "circle");
		circle.setAttribute("cx", "12");
		circle.setAttribute("cy", "12");
		circle.setAttribute("r", "9");
		svg.append(circle);
	}
	for (const definition of ICON_PATHS[name]) {
		const path = document.createElementNS(SVG_NAMESPACE, "path");
		path.setAttribute("d", definition);
		svg.append(path);
	}
	return svg;
}
