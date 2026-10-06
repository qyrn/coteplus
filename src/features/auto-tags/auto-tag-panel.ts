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
import type { Settings } from "../settings/settings";
import { countLinkChanges, planAutoTags, type TagChange } from "./auto-tag-plan";
import {
	AUTO_TAG_RULE_IDS,
	AUTO_TAGS,
	type AutoTagRuleId,
	COTE_RULE_IDS,
	type CollectionCopy,
	createAutoTagRules,
	type TagSpec,
} from "./auto-tag-rules";
import { type EnabledRules, enabledRuleIds, enabledRulesItem, readEnabledRules } from "./auto-tag-settings";
import { type ExistingTag, extensionTags } from "./tag-ownership";
import { applyTagChanges, deleteTags, loadTagSnapshot } from "./tag-repository";

const PANEL_ID = "wmp-auto-tags";

function ruleLabel(id: AutoTagRuleId, settings: Settings): string {
	if (id === "forSale") return `À vendre (cote ≥ ${formatAmount(settings.autoTagForSaleMinCote)} W)`;
	if (id === "discard") return `À défausser (cote < ${formatAmount(settings.autoTagDiscardMaxCote)} W)`;
	return id === "duplicates" ? "Doublons" : "Catégories";
}

function tagChip(tag: TagSpec): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className = "wmp-chip wmp-tag-chip";
	chip.style.setProperty("--wmp-tag-color", tag.color);
	chip.textContent = `#${tag.name}`;
	return chip;
}

function countChip(count: number, sign: "+" | "−"): HTMLSpanElement {
	if (count === 0) return document.createElement("span");
	const chip = document.createElement("span");
	chip.className = "wmp-chip";
	chip.dataset.tone = sign === "+" ? "good" : "bad";
	chip.textContent = `${sign}${formatAmount(count)}`;
	return chip;
}

function previewRow(tag: TagSpec, statusText: string, additions: number, removals: number): HTMLLIElement {
	const row = document.createElement("li");
	row.className = "wmp-row wmp-auto-tag-row";
	const status = document.createElement("span");
	status.className = "wmp-auto-tag-status";
	status.textContent = statusText;
	row.append(tagChip(tag), status, countChip(additions, "+"), countChip(removals, "−"));
	return row;
}

function taggedCopyCount(copies: readonly CollectionCopy[], tag: ExistingTag): number {
	return copies.filter((copy) => copy.tagIds.includes(tag.id)).length;
}

function changeRow(change: TagChange): HTMLLIElement {
	return previewRow(change.tag, change.tagId ? "" : "nouvelle", change.additions.length, 0);
}

function userOwnedRow(tag: TagSpec): HTMLLIElement {
	return previewRow(tag, "la tienne, pas touchée", 0, 0);
}

function errorMessage(error: unknown): string {
	if (error instanceof SupabaseSessionError) {
		return "Ta session sur le site n'a pas pu être lue. Recharge la page puis réessaie.";
	}
	const detail = error instanceof Error ? ` (${error.message})` : "";
	return `Le site a refusé la demande${detail}. Une partie a pu être appliquée : relance l'aperçu pour voir ce qui reste.`;
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
	const prepareDeletionButton = createButton("Supprimer les étiquettes auto", "ghost");
	const confirmDeletionButton = createButton("Confirmer la suppression", "soft");
	const reloadButton = createButton("Recharger la page", "ghost");
	const actionButtons = [prepareButton, applyButton, prepareDeletionButton, confirmDeletionButton];
	const actions = document.createElement("div");
	actions.className = "wmp-auto-tag-actions";
	actions.append(...actionButtons, reloadButton);
	const list = document.createElement("ul");
	list.className = "wmp-rows wmp-auto-tag-list";
	const status = note(
		"Pose tes étiquettes toute seule selon les règles cochées. Tu vois le détail avant que quoi que ce soit change. Tes propres étiquettes ne sont jamais touchées.",
	);
	body.append(switches, actions, list, status);

	let pendingChanges: TagChange[] = [];
	let pendingRetiredTags: ExistingTag[] = [];
	let pendingDeletion: ExistingTag[] = [];

	function resetPreview(): void {
		pendingChanges = [];
		pendingRetiredTags = [];
		pendingDeletion = [];
		list.replaceChildren();
		meta.textContent = "";
		applyButton.hidden = true;
		confirmDeletionButton.hidden = true;
		reloadButton.hidden = true;
	}

	function refreshLabels(): void {
		const current = settings.current();
		for (const [id, text] of labelTexts) text.textContent = ruleLabel(id, current);
	}

	function currentRules(): EnabledRules {
		return readEnabledRules(Object.fromEntries([...inputs].map(([id, input]) => [id, input.checked])));
	}

	function setBusy(isBusy: boolean): void {
		for (const button of actionButtons) button.disabled = isBusy;
		for (const input of inputs.values()) input.disabled = isBusy;
	}

	async function runBusy(task: () => Promise<void>): Promise<void> {
		setBusy(true);
		try {
			await task();
		} catch (error) {
			status.textContent = errorMessage(error);
		} finally {
			setBusy(false);
		}
	}

	async function prepare(): Promise<void> {
		resetPreview();
		refreshLabels();
		const { autoTagForSaleMinCote, autoTagDiscardMaxCote } = settings.current();
		const ruleIds = enabledRuleIds(currentRules());
		if (ruleIds.length === 0) {
			status.textContent = "Coche au moins une règle.";
			return;
		}
		status.textContent = "Lecture de ta collection et de tes étiquettes...";
		const snapshot = await loadTagSnapshot(await connectSupabase());
		const cards = [...new Map(snapshot.copies.map((copy) => [copy.cardId, copy])).values()];
		const usesCote = ruleIds.some((id) => COTE_RULE_IDS.includes(id));
		const stats = usesCote ? await priceService.cachedPriceStats(cards) : new Map<string, PriceStats>();
		const rules = createAutoTagRules(snapshot.copies, (copy) => stats.get(copy.cardId)?.value ?? null, {
			forSaleMinCote: autoTagForSaleMinCote,
			discardMaxCote: autoTagDiscardMaxCote,
		});
		const plan = planAutoTags(
			snapshot.copies,
			ruleIds.map((id) => rules[id]),
			snapshot.tags,
		);
		pendingChanges = plan.changes;
		pendingRetiredTags = plan.retiredTags;
		list.replaceChildren(
			...plan.changes.map(changeRow),
			...plan.retiredTags.map((tag) =>
				previewRow(tag, "ancienne, supprimée", 0, taggedCopyCount(snapshot.copies, tag)),
			),
			...plan.userOwnedTags.map(userOwnedRow),
		);
		const total = countLinkChanges(plan.changes) + plan.retiredTags.length;
		meta.textContent = total > 0 ? `${formatAmount(total)} changements` : "";
		applyButton.hidden = total === 0;
		const freshNote = ` ${formatAmount(plan.freshCopyCount)} cartes pas encore classées par l'extension : les cartes qui ont déjà une étiquette auto ne bougent plus.`;
		const coteNote = usesCote
			? ` Cote connue pour ${formatAmount(stats.size)} cartes sur ${formatAmount(cards.length)} : sans cote, ni #À vendre ni #À défausser, et jamais sur un favori.`
			: "";
		const userOwnedNote =
			plan.userOwnedTags.length > 0
				? " Tu as déjà une étiquette à toi avec le même nom qu'une étiquette auto : elle reste telle quelle."
				: "";
		const lead =
			total === 0 ? "Tout est déjà classé." : "Rien n'est modifié tant que tu ne cliques pas sur « Appliquer ».";
		status.textContent = `${lead}${freshNote}${coteNote}${userOwnedNote}`;
	}

	async function apply(): Promise<void> {
		const changes = pendingChanges;
		const retiredTags = pendingRetiredTags;
		const linkTotal = countLinkChanges(changes);
		const total = linkTotal + retiredTags.length;
		const showProgress = (done: number): void => {
			status.textContent = `Application : ${formatAmount(done)} / ${formatAmount(total)}`;
		};
		showProgress(0);
		const rest = await connectSupabase();
		await applyTagChanges(rest, changes, showProgress);
		await deleteTags(rest, retiredTags, (done) => showProgress(linkTotal + done));
		pendingChanges = [];
		pendingRetiredTags = [];
		applyButton.hidden = true;
		reloadButton.hidden = false;
		status.textContent = "Classement appliqué. Recharge la page pour voir les étiquettes sur tes cartes.";
	}

	async function prepareDeletion(): Promise<void> {
		resetPreview();
		status.textContent = "Lecture de tes étiquettes...";
		const snapshot = await loadTagSnapshot(await connectSupabase());
		const tags = extensionTags(snapshot.tags, AUTO_TAGS);
		pendingDeletion = tags;
		list.replaceChildren(...tags.map((tag) => previewRow(tag, "supprimée", 0, taggedCopyCount(snapshot.copies, tag))));
		meta.textContent = tags.length > 0 ? `${formatAmount(tags.length)} étiquettes` : "";
		confirmDeletionButton.hidden = tags.length === 0;
		status.textContent =
			tags.length === 0
				? "Aucune étiquette créée par l'extension."
				: "Seules les étiquettes créées par l'extension partent (même nom et même couleur qu'à leur création). Les tiennes restent. Rien n'est supprimé tant que tu ne confirmes pas.";
	}

	async function confirmDeletion(): Promise<void> {
		const tags = pendingDeletion;
		status.textContent = `Suppression : 0 / ${formatAmount(tags.length)}`;
		await deleteTags(await connectSupabase(), tags, (done) => {
			status.textContent = `Suppression : ${formatAmount(done)} / ${formatAmount(tags.length)}`;
		});
		pendingDeletion = [];
		confirmDeletionButton.hidden = true;
		reloadButton.hidden = false;
		status.textContent = "Étiquettes auto supprimées. Recharge la page pour voir le résultat.";
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
	prepareButton.addEventListener("click", () => void runBusy(prepare));
	applyButton.addEventListener("click", () => void runBusy(apply));
	prepareDeletionButton.addEventListener("click", () => void runBusy(prepareDeletion));
	confirmDeletionButton.addEventListener("click", () => void runBusy(confirmDeletion));
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
