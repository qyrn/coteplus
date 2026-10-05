const KEY_SEARCH_WINDOW = 400;

let cachedKey: Promise<string | null> | null = null;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractPublicKey(scriptText: string, projectRef: string): string | null {
	const pattern = new RegExp(
		`${escapeRegExp(projectRef)}\\.supabase\\.co["'\`][\\s\\S]{0,${KEY_SEARCH_WINDOW}}?["'\`](eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+|sb_publishable_[\\w-]+)["'\`]`,
	);
	return pattern.exec(scriptText)?.[1] ?? null;
}

function pageScriptUrls(): string[] {
	const sources = [
		...[...document.scripts].map((script) => script.src),
		...performance.getEntriesByType("resource").map((entry) => entry.name),
	];
	return [
		...new Set(
			sources.filter((source) => {
				if (!source) return false;
				const url = new URL(source, location.href);
				return url.origin === location.origin && url.pathname.endsWith(".js");
			}),
		),
	];
}

async function searchPageScripts(projectRef: string): Promise<string | null> {
	for (const url of pageScriptUrls()) {
		const response = await fetch(url).catch(() => null);
		if (!response?.ok) continue;
		const key = extractPublicKey(await response.text(), projectRef);
		if (key) return key;
	}
	return null;
}

export function findSupabasePublicKey(projectRef: string): Promise<string | null> {
	cachedKey ??= searchPageScripts(projectRef).then((key) => {
		if (!key) cachedKey = null;
		return key;
	});
	return cachedKey;
}
