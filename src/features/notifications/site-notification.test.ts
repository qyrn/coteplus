import { describe, expect, it } from "vitest";
import { categoryOf, latestCreatedAt, parseNotifications, unseenNotifications } from "./site-notification";

const json = {
	notifications: [
		{
			id: "n1",
			type: "marketplace_outbid",
			read: false,
			created_at: "2026-10-03T06:23:06.164Z",
			data: { title: "📉 Vous avez été surenchéri", message: "trchsl a misé 50 wikibidous.", auction_id: "a-1" },
		},
		{
			id: "n2",
			type: "trade_offer",
			read: true,
			created_at: "2026-10-03T06:10:22.174Z",
			data: { title: "🔄 Nouvelle offre d'échange !", message: "euroglime vous propose un échange.", trade_id: "t" },
		},
		{ id: "n3", type: "battle_invite", read: false, created_at: "2026-10-03T07:00:00Z", data: { battle_id: "b-9" } },
		{ id: "bad", type: 4 },
	],
};

describe("parseNotifications", () => {
	it("reads the category, a clean title and the page to open", () => {
		const [outbid, offer, duel] = parseNotifications(json);
		expect(outbid).toMatchObject({ category: "market", title: "Vous avez été surenchéri", path: "/marketplace/a-1" });
		expect(offer).toMatchObject({ category: "trades", title: "Nouvelle offre d'échange !", path: "/trades" });
		expect(duel).toMatchObject({ category: "battles", title: "Bataille", path: "/battle/duels/b-9" });
		expect(parseNotifications(json)).toHaveLength(3);
	});
});

describe("unseenNotifications", () => {
	it("keeps unread notifications newer than the last check, oldest first", () => {
		const notifications = parseNotifications(json);
		const unseen = unseenNotifications(notifications, Date.parse("2026-10-03T06:00:00Z"));
		expect(unseen.map((notification) => notification.id)).toEqual(["n1", "n3"]);
		expect(latestCreatedAt(notifications, 0)).toBe(Date.parse("2026-10-03T07:00:00Z"));
	});
});

describe("categoryOf", () => {
	it("sorts unknown types into other", () => {
		expect(categoryOf("friend_request")).toBe("friends");
		expect(categoryOf("admin_sanction")).toBe("other");
	});
});
