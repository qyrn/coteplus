import { describe, expect, it } from "vitest";
import { parseWikibidous, readTradeSides } from "./trade-side";
import { balanceText, sideValueText } from "./trade-values";

const tradeMarkup = `
<button aria-label="Voir le détail de l'échange">
	<div><span>À xox3my</span></div>
	<div>
		<div class="flex-1">
			<p>Vous offrez</p>
			<div>
				<span title="Idéal de beauté féminin" style="color: var(--color-rarity-r)">R · Idéal de beauté fé…</span>
				<span title="Paradis" style="color: var(--color-rarity-sr)">SR · Paradis</span>
			</div>
		</div>
		<div class="flex-1">
			<p>xox3my offre</p>
			<div><span><svg></svg>1 700 wb</span></div>
		</div>
	</div>
</button>`;

describe("readTradeSides", () => {
	it("reads cards and wikibidous of both sides", () => {
		document.body.innerHTML = tradeMarkup;
		const sides = readTradeSides(document.body);
		expect(sides.map((side) => ({ isMine: side.isMine, cards: side.cards, wikibidous: side.wikibidous }))).toEqual([
			{
				isMine: true,
				cards: [
					{ title: "Idéal de beauté féminin", rarity: "R" },
					{ title: "Paradis", rarity: "SR" },
				],
				wikibidous: 0,
			},
			{ isMine: false, cards: [], wikibidous: 1700 },
		]);
	});
});

describe("parseWikibidous", () => {
	it("reads amounts in wikibidous", () => {
		expect(parseWikibidous("1 700 wb")).toBe(1700);
		expect(parseWikibidous("Rien")).toBeNull();
	});
});

describe("trade value texts", () => {
	it("formats a side value", () => {
		expect(sideValueText({ total: 1240, unpricedCards: 1 })).toBe("≈ 1 240 W (1 sans prix)");
	});

	it("formats the balance from the player's point of view", () => {
		expect(balanceText({ total: 100, unpricedCards: 0 }, { total: 350, unpricedCards: 0 })).toBe(
			"Bilan pour toi : +250 W",
		);
		expect(balanceText({ total: 400, unpricedCards: 0 }, { total: 100, unpricedCards: 0 })).toBe(
			"Bilan pour toi : −300 W",
		);
		expect(balanceText({ total: 50, unpricedCards: 0 }, { total: 50, unpricedCards: 0 })).toBe("Échange équilibré");
	});
});
