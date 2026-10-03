import { type IconName, icon } from "./icons";

export type ButtonVariant = "soft" | "ghost" | "quiet" | "icon";

export function setButtonContent(button: HTMLButtonElement, label: string, iconName?: IconName): void {
	const children: Node[] = iconName ? [icon(iconName)] : [];
	if (button.classList.contains("wmp-btn-icon")) {
		button.setAttribute("aria-label", label);
	} else {
		const text = document.createElement("span");
		text.textContent = label;
		children.push(text);
	}
	button.replaceChildren(...children);
}

export function createButton(label: string, variant: ButtonVariant, iconName?: IconName): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `wmp-btn wmp-btn-${variant}`;
	setButtonContent(button, label, iconName);
	return button;
}
