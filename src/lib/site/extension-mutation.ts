import { SITE_TILE_MARKER_CLASSES } from "./site-tile-markers";

export interface ObservedMutation {
	target: Node;
	addedNodes: Iterable<Node>;
	removedNodes: Iterable<Node>;
}

const EXTENSION_NODE_SELECTOR = `[id^="wmp-"], [class*="wmp-"]${SITE_TILE_MARKER_CLASSES.map((markerClass) => `:not(.${markerClass})`).join("")}`;

function isExtensionNode(node: Node): boolean {
	const element = node instanceof Element ? node : node.parentElement;
	return element?.closest(EXTENSION_NODE_SELECTOR) != null;
}

export function isExtensionMutation(mutation: ObservedMutation): boolean {
	if (isExtensionNode(mutation.target)) return true;
	const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
	return changedNodes.length > 0 && changedNodes.every((node) => node instanceof Element && isExtensionNode(node));
}
