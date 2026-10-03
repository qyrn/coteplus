const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const WIDTH = 300;
const HEIGHT = 56;
const PADDING = 4;

export function sparklinePoints(values: readonly number[], width: number, height: number, padding: number): string {
	if (values.length < 2) return "";
	const min = Math.min(...values);
	const range = Math.max(...values) - min || 1;
	const stepX = (width - padding * 2) / (values.length - 1);
	return values
		.map((value, index) => {
			const x = padding + index * stepX;
			const y = height - padding - ((value - min) / range) * (height - padding * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
}

export function createSparkline(values: readonly number[], label: string): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, "svg");
	svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
	svg.setAttribute("preserveAspectRatio", "none");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", label);
	svg.classList.add("wmp-value-sparkline");
	const points = sparklinePoints(values, WIDTH, HEIGHT, PADDING);
	const area = document.createElementNS(SVG_NAMESPACE, "polygon");
	area.setAttribute("points", `${PADDING},${HEIGHT} ${points} ${WIDTH - PADDING},${HEIGHT}`);
	const line = document.createElementNS(SVG_NAMESPACE, "polyline");
	line.setAttribute("points", points);
	line.setAttribute("vector-effect", "non-scaling-stroke");
	svg.append(area, line);
	return svg;
}
