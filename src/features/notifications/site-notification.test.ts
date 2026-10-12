import { describe, expect, it } from "vitest";
import { categoryOf, latestCreatedAt, parseNotifications, unseenNotifications } from "./site-notification";

const json = {
	notifications: [
		{
			id: "n1",
			type: "marketplace_outbid",
			read: false,
			created_at: "2026-10-03T06:23:06.164Z",
			data: { title: "📉 Vous avez été surenchéri", message: "joueur7 a misé 50 wikibidous.", auction_id: "a-1" },
		},
		{
			id: "n2",
			type: "trade_offer",
			read: true,
			created_at: "2026-10-03T06:10:22.174Z",
			data: { title: "🔄 Nouvelle offre d'échange !", message: "rival99 vous propose un échange.", trade_id: "t" },
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
		expect(duel).toMatchObject({ category: "battles", title: "Bataille", path: "/battle/b-9" });
		expect(parseNotifications(json)).toHaveLength(3);
	});

	it("opens the same page as the site for every notification type", () => {
		const pathOf = (type: string, data: object): string | undefined =>
			parseNotifications({ notifications: [{ id: "n", type, created_at: "2026-10-03T07:00:00Z", data }] })[0]?.path;
		expect(pathOf("chat_message", {})).toBe("/dms");
		expect(pathOf("guild_invite", { guild_id: "g1", guild_name: "Les Bidous" })).toBe(
			"/guild?invite=g1&name=Les%20Bidous",
		);
		expect(pathOf("guild_join", {})).toBe("/guild");
		expect(pathOf("marketplace_auction_won", {})).toBe("/marketplace");
		expect(pathOf("custom", { duel_id: "d-2" })).toBe("/battle/duels/d-2");
		expect(pathOf("custom", { href: "/collection" })).toBe("/collection");
		expect(pathOf("custom", { href: "//evil.example" })).toBe("/trades");
		expect(pathOf("admin_sanction", {})).toBe("/trades");
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
