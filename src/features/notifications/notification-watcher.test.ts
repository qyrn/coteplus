import { describe, expect, it } from "vitest";
import { readUnreadCount } from "./notification-watcher";

describe("readUnreadCount", () => {
	it("reads the bell badge and flags the capped value", () => {
		document.body.innerHTML = `<button aria-label="Notifications"><svg></svg><span>3</span></button>`;
		expect(readUnreadCount(document)).toEqual({ count: 3, capped: false });
		document.body.innerHTML = `<button aria-label="Notifications"><span>9+</span></button>`;
		expect(readUnreadCount(document)).toEqual({ count: 9, capped: true });
		document.body.innerHTML = `<button aria-label="Notifications"><svg></svg></button>`;
		expect(readUnreadCount(document)).toEqual({ count: 0, capped: false });
	});
});
