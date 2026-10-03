import { type FollowedAuction, readFollowedAuctions } from "./followed-auctions";

export type StandingChangeKind = "outbid" | "won";

export interface StandingChange {
	kind: StandingChangeKind;
	auction: FollowedAuction;
}

export function standingChanges(previous: unknown, next: unknown): StandingChange[] {
	const before = new Map(readFollowedAuctions(previous).map((auction) => [auction.id, auction.standing]));
	return readFollowedAuctions(next).flatMap((auction): StandingChange[] => {
		const previousStanding = before.get(auction.id);
		if (previousStanding === "leading" && auction.standing === "outbid") return [{ kind: "outbid", auction }];
		if (previousStanding !== undefined && previousStanding !== "won" && auction.standing === "won") {
			return [{ kind: "won", auction }];
		}
		return [];
	});
}
