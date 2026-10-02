const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function timeUntil(target: number, now: number): string {
	const remaining = target - now;
	if (remaining <= 0) return "terminée";
	if (remaining < MINUTE_MS) return "dans moins d'1 min";
	if (remaining < HOUR_MS) return `dans ${Math.floor(remaining / MINUTE_MS)} min`;
	if (remaining < DAY_MS) {
		const hours = Math.floor(remaining / HOUR_MS);
		const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
		return `dans ${hours} h ${String(minutes).padStart(2, "0")}`;
	}
	const days = Math.floor(remaining / DAY_MS);
	return `dans ${days} j ${Math.floor((remaining % DAY_MS) / HOUR_MS)} h`;
}
