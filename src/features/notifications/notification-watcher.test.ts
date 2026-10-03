import { describe, expect, it } from "vitest";
import { readUnreadCount } from "./notification-watcher";

describe("readUnreadCount", () => {
	it("reads the bell badge, including the capped value", () => {
		document.body.innerHTML = `<button aria-label="Notifications"><svg></svg><span>3</span></button>`;
		expect(readUnreadCount(document)).toBe(3);
		document.body.innerHTML = `<button aria-label="Notifications"><span>9+</span></button>`;
		expect(readUnreadCount(document)).toBe(9);
		document.body.innerHTML = `<button aria-label="Notifications"><svg></svg></button>`;
		expect(readUnreadCount(document)).toBe(0);
	});
});
