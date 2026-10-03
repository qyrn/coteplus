const TOAST_DURATION_MS = 4000;

let hideTimer: number | undefined;

export function showToast(message: string): void {
	const toast = document.querySelector<HTMLElement>(".wmp-toast") ?? document.createElement("div");
	toast.className = "wmp-toast";
	toast.setAttribute("role", "status");
	toast.textContent = message;
	if (!toast.isConnected) document.body.append(toast);
	window.clearTimeout(hideTimer);
	hideTimer = window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}
