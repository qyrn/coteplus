import { storage } from "wxt/utils/storage";
import { isRecord } from "../../lib/json";
import { AUTO_TAG_RULE_IDS, type AutoTagRuleId } from "./auto-tag-rules";

export type EnabledRules = Record<AutoTagRuleId, boolean>;

export const enabledRulesItem = storage.defineItem<unknown>("local:auto-tag-rules", { fallback: {} });

export function readEnabledRules(value: unknown): EnabledRules {
	const stored = isRecord(value) ? value : {};
	return {
		duplicates: stored.duplicates !== false,
		forSale: stored.forSale !== false,
		category: stored.category !== false,
	};
}

export function enabledRuleIds(rules: EnabledRules): AutoTagRuleId[] {
	return AUTO_TAG_RULE_IDS.filter((id) => rules[id]);
}
