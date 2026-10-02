import { describe, expect, it } from "vitest";
import { compareToAverage, dealText, parseAmount, readAuctionPrice } from "./auction-deal";

describe("compareToAverage", () => {
	it("flags prices well under the average as great deals", () => {
		expect(compareToAverage(65, 100)).toEqual({ level: "great", differencePercent: -35 });
	});

	it("treats prices close to the average as fair", () => {
		expect(compareToAverage(95, 100)).toEqual({ level: "fair", differencePercent: -5 });
	});

	it("flags prices above the average as expensive", () => {
		expect(compareToAverage(130, 100)).toEqual({ level: "expensive", differencePercent: 30 });
	});

	it("ignores missing averages", () => {
		expect(compareToAverage(10, 0)).toBeNull();
	});
});

describe("parseAmount", () => {
	it("reads French formatted numbers", () => {
		expect(parseAmount("1 240")).toBe(1240);
		expect(parseAmount(" 10 ")).toBe(10);
		expect(parseAmount("10 W")).toBeNull();
	});
});

describe("readAuctionPrice", () => {
	it("reads the amount next to the price label", () => {
		document.body.innerHTML = "<div><div><span>Mise actuelle</span><span>1 240</span></div></div>";
		expect(readAuctionPrice(document.body)?.amount).toBe(1240);
	});

	it("ignores settled auctions", () => {
		document.body.innerHTML = "<div><span>Vendue pour</span><span>300</span></div>";
		expect(readAuctionPrice(document.body)).toBeNull();
	});
});

describe("dealText", () => {
	it("formats the difference", () => {
		expect(dealText({ level: "great", differencePercent: -35 })).toBe("−35 % vs moy.");
		expect(dealText({ level: "expensive", differencePercent: 30 })).toBe("+30 % vs moy.");
		expect(dealText({ level: "fair", differencePercent: 4 })).toBe("≈ moyenne");
	});
});
