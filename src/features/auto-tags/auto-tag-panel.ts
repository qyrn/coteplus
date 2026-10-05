import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { connectSupabase, SupabaseSessionError } from "../../lib/net/supabase-rest";
import type { PageWatcher } from "../../lib/site/page-watcher";
import { formatAmount } from "../../lib/ui/amount";
import { createButton } from "../../lib/ui/button";
import { createPanel, note } from "../../lib/ui/panel";
import { collectionExtrasSlot } from "../collection/collection-extras-slot";
import type { PriceService } from "../prices/price-service";
import type { PriceStats } from "../prices/price-summary";
import type { LiveSettings } from "../settings/live-settings";
import { countLinkChanges, planAutoTags, type TagChange } from "./auto-tag-plan";
import { AUTO_TAG_RULE_IDS, type AutoTagRuleId, createAutoTagRules } from "./auto-tag-rules";
import { type EnabledRules, enabledRuleIds, enabledRulesItem, readEnabledRules } from "./auto-tag-settings";
import { applyTagChanges, loadTagSnapshot } from "./tag-repository";

const PANEL_ID = "wmp-auto-tags";

function ruleLabel(id: AutoTagRuleId, forSaleMinCote: number): string {
	if (id === "forSale") return `À vendre (cote ≥ ${formatAmount(forSaleMinCote)} W)`;
	return id === "duplicates" ? "Doublons" : "Catégories";
}

function tagChip(change: TagChange): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className = "wmp-chip wmp-tag-chip";
	chip.style.setProperty("--wmp-tag-color", change.tag.color);
	chip.textContent = `#${change.tag.name}`;
	return chip;
}

function countChip(text: string, tone: "good" | "bad" | "neutral"): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className = "wmp-chip";
	chip.dataset.tone = tone;
	chip.textContent = text;
	return chip;
}

function changeRow(change: TagChange): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-row wmp-auto-tag-row";
	const status = document.createElement("span");
	status.className = "wmp-auto-tag-status";
	status.textContent = change.tagId ? "" : "nouvelle";
	const additions = change.additions.length > 0 ? `+${formatAmount(change.additions.length)}` : "";
	const removals = change.removals.length > 0 ? `−${formatAmount(change.removals.length)}` : "";
	row.append(
		tagChip(change),
		status,
		additions ? countChip(additions, "good") : document.createElement("span"),
		removals ? countChip(removals, "bad") : document.createElement("span"),
	);
	return row;
}

function errorMessage(error: unknown): string {
	if (error instanceof SupabaseSessionError) {
		return "Ta session sur le site n'a pas pu être lue. Recharge la page puis réessaie.";
	}
	const detail = error instanceof Error ? ` (${error.message})` : "";
	return `Le site a refusé la demande${detail}. Une partie a pu être appliquée : relance « Préparer » pour voir ce qui reste.`;
}

export function startAutoTagPanel(
	ctx: ContentScriptContext,
	pageWatcher: PageWatcher,
	priceService: PriceService,
	settings: LiveSettings,
): void {
	const { root: panel, meta, body } = createPanel(PANEL_ID, "Classement auto", "tag");
	const switches = document.createElement("div");
	switches.className = "wmp-auto-tag-rules";
	const inputs = new Map<AutoTagRuleId, HTMLInputElement>();
	const labelTexts = new Map<AutoTagRuleId, HTMLSpanElement>();
	for (const id of AUTO_TAG_RULE_IDS) {
		const label = document.createElement("label");
		label.className = "wmp-switch";
		const input = document.createElement("input");
		input.type = "checkbox";
		input.setAttribute("role", "switch");
		const text = document.createElement("span");
		label.append(input, text);
		inputs.set(id, input);
		labelTexts.set(id, text);
		switches.append(label);
	}
	const prepareButton = createButton("Préparer", "soft", "tag");
	const applyButton = createButton("Appliquer", "soft");
	const reloadButton = createButton("Recharger la page", "ghost");
	const actions = document.createElement("div");
	actions.className = "wmp-auto-tag-actions";
	actions.append(prepareButton, applyButton, reloadButton);
	const list = document.createElement("ul");
	list.className = "wmp-rows wmp-auto-tag-list";
	const status = note(
		"Pose tes étiquettes toute seule selon les règles cochées. Tu vois le détail avant que quoi que ce soit change.",
	);
	body.append(switches, actions, list, status);

	let pendingChanges: TagChange[] = [];

	function resetPreview(): void {
		pendingChanges = [];
		list.replaceChildren();
		meta.textContent = "";
		applyButton.hidden = true;
		reloadButton.hidden = true;
	}

	function refreshLabels(): void {
		const { autoTagForSaleMinCote } = settings.current();
		for (const [id, text] of labelTexts) text.textContent = ruleLabel(id, autoTagForSaleMinCote);
	}

	function currentRules(): EnabledRules {
		return readEnabledRules(Object.fromEntries([...inputs].map(([id, input]) => [id, input.checked])));
	}

	function setBusy(isBusy: boolean): void {
		prepareButton.disabled = isBusy;
		applyButton.disabled = isBusy;
		for (const input of inputs.values()) input.disabled = isBusy;
	}

	async function prepare(): Promise<void> {
		resetPreview();
		refreshLabels();
		const { autoTagForSaleMinCote } = settings.current();
		const ruleIds = enabledRuleIds(currentRules());
		if (ruleIds.length === 0) {
			status.textContent = "Coche au moins une règle.";
			return;
		}
		setBusy(true);
		status.textContent = "Lecture de ta collection et de tes étiquettes...";
		try {
			const snapshot = await loadTagSnapshot(await connectSupabase());
			const cards = [...new Map(snapshot.copies.map((copy) => [copy.cardId, copy])).values()];
			const stats = ruleIds.includes("forSale")
				? await priceService.cachedPriceStats(cards)
				: new Map<string, PriceStats>();
			const rules = createAutoTagRules(
				snapshot.copies,
				(copy) => stats.get(copy.cardId)?.value ?? null,
				autoTagForSaleMinCote,
			);
			pendingChanges = planAutoTags(
				snapshot.copies,
				ruleIds.map((id) => rules[id]),
				snapshot.tags,
			);
			list.replaceChildren(...pendingChanges.map(changeRow));
			const total = countLinkChanges(pendingChanges);
			meta.textContent = total > 0 ? `${formatAmount(total)} changements` : "";
			applyButton.hidden = total === 0;
			const saleNote = ruleIds.includes("forSale")
				? ` Cote connue pour ${formatAmount(stats.size)} cartes sur ${formatAmount(cards.length)} : les autres ne bougent pas pour #À vendre, et les favoris ne sont jamais proposés.`
				: "";
			status.textContent =
				total === 0
					? `Tout est déjà classé.${saleNote}`
					: `Rien n'est modifié tant que tu ne cliques pas sur « Appliquer ».${saleNote}`;
		} catch (error) {
			status.textContent = errorMessage(error);
		} finally {
			setBusy(false);
		}
	}

	async function apply(): Promise<void> {
		const changes = pendingChanges;
		const total = countLinkChanges(changes);
		setBusy(true);
		status.textContent = `Application : 0 / ${formatAmount(total)}`;
		try {
			await applyTagChanges(await connectSupabase(), changes, (done) => {
				status.textContent = `Application : ${formatAmount(done)} / ${formatAmount(total)}`;
			});
			pendingChanges = [];
			applyButton.hidden = true;
			reloadButton.hidden = false;
			status.textContent = "Classement appliqué. Recharge la page pour voir les étiquettes sur tes cartes.";
		} catch (error) {
			status.textContent = errorMessage(error);
		} finally {
			setBusy(false);
		}
	}

	async function loadRules(): Promise<void> {
		const rules = readEnabledRules(await enabledRulesItem.getValue());
		for (const [id, input] of inputs) input.checked = rules[id];
	}

	for (const input of inputs.values()) {
		input.addEventListener("change", () => {
			resetPreview();
			void enabledRulesItem.setValue(currentRules());
		});
	}
	panel.addEventListener("toggle", refreshLabels);
	prepareButton.addEventListener("click", () => void prepare());
	applyButton.addEventListener("click", () => void apply());
	reloadButton.addEventListener("click", () => location.reload());
	ctx.onInvalidated(enabledRulesItem.watch(() => void loadRules()));
	resetPreview();
	refreshLabels();
	void loadRules();

	pageWatcher.subscribe(() => {
		if (location.pathname !== "/collection") return;
		const slot = collectionExtrasSlot();
		if (slot && panel.parentElement !== slot) slot.append(panel);
	});
}
