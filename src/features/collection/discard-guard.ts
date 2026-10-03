export interface DiscardCheck {
	average: number | null;
	starred: boolean;
	lastCopy: boolean;
}

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function discardWarnings(check: DiscardCheck, minPrice: number): string[] {
	const warnings: string[] = [];
	if (check.average !== null && check.average >= minPrice) {
		warnings.push(
			`Elle vaut environ ${amountFormatter.format(check.average)} W aux enchères, la défausse ne rapporte que 1 W.`,
		);
	}
	if (check.starred) warnings.push("Elle fait partie de tes favoris.");
	if (warnings.length > 0 && check.lastCopy) warnings.push("C'est ton dernier exemplaire.");
	return warnings;
}
