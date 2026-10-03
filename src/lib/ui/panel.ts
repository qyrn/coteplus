import { type IconName, icon } from "./icons";

export interface Panel {
	root: HTMLDetailsElement;
	meta: HTMLSpanElement;
	body: HTMLDivElement;
}

export function createPanel(id: string, title: string, iconName: IconName): Panel {
	const root = document.createElement("details");
	root.id = id;
	root.className = "wmp-panel";
	const summary = document.createElement("summary");
	summary.className = "wmp-panel-summary";
	const heading = document.createElement("span");
	heading.className = "wmp-panel-title";
	heading.textContent = title;
	const meta = document.createElement("span");
	meta.className = "wmp-panel-meta";
	summary.append(icon(iconName), heading, meta, icon("chevron"));
	const body = document.createElement("div");
	body.className = "wmp-panel-body";
	root.append(summary, body);
	return { root, meta, body };
}

export function createPanelHeader(title: string, iconName: IconName): HTMLDivElement {
	const header = document.createElement("div");
	header.className = "wmp-panel-summary wmp-panel-header";
	const heading = document.createElement("h2");
	heading.className = "wmp-panel-title";
	heading.textContent = title;
	header.append(icon(iconName), heading);
	return header;
}

export function note(text: string): HTMLParagraphElement {
	const paragraph = document.createElement("p");
	paragraph.className = "wmp-note";
	paragraph.textContent = text;
	return paragraph;
}
