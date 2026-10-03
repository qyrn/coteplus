import { icon } from "./icons";

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatAmount(amount: number): string {
	return amountFormatter.format(amount);
}

export function signedAmountText(amount: number): string {
	const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
	return `${sign}${formatAmount(Math.abs(amount))}`;
}

export function amountElement(text: string, prefix = ""): HTMLSpanElement {
	const element = document.createElement("span");
	element.className = "wmp-amount";
	if (prefix) element.append(prefix);
	element.append(icon("coin"), text);
	return element;
}
