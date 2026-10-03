import { describe, expect, it } from "vitest";
import { compareToCote, dealText, parseAmount, readAuctionAmount } from "./auction-deal";

describe("compareToCote", () => {
	it("flags prices well under the cote as great deals", () => {
		expect(compareToCote(65, 100, 20)).toEqual({ level: "great", differencePercent: -35 });
	});

	it("treats prices close to the cote as fair", () => {
		expect(compareToCote(95, 100, 20)).toEqual({ level: "fair", differencePercent: -5 });
	});

	it("flags prices above the cote as expensive", () => {
		expect(compareToCote(130, 100, 20)).toEqual({ level: "expensive", differencePercent: 30 });
	});

	it("ignores missing cotes", () => {
		expect(compareToCote(10, 0, 20)).toBeNull();
	});
});

describe("parseAmount", () => {
	it("reads French formatted numbers", () => {
		expect(parseAmount("1 240")).toBe(1240);
		expect(parseAmount(" 10 ")).toBe(10);
		expect(parseAmount("10 W")).toBeNull();
	});
});

describe("readAuctionAmount", () => {
	it("reads the amount next to the price label", () => {
		document.body.innerHTML = "<div><div><span>Mise actuelle</span><span>1 240</span></div></div>";
		expect(readAuctionAmount(document.body)).toBe(1240);
	});

	it("ignores settled auctions", () => {
		document.body.innerHTML = "<div><span>Vendue pour</span><span>300</span></div>";
		expect(readAuctionAmount(document.body)).toBeNull();
	});
});

describe("dealText", () => {
	it("formats the difference", () => {
		expect(dealText({ level: "great", differencePercent: -35 })).toBe("−35 % vs cote");
		expect(dealText({ level: "expensive", differencePercent: 30 })).toBe("+30 % vs cote");
		expect(dealText({ level: "fair", differencePercent: 4 })).toBe("≈ cote");
	});
});
