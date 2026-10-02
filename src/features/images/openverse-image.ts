import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { FoundImage } from "./found-image";
import { commonsFileUrl } from "./wikimedia-image";

const ALLOWED_LICENSES = ["cc0", "pdm", "by", "by-sa", "by-nc", "by-nc-sa"] as const;
const PAGE_SIZE = 20;
const MIN_NAME_WORDS = 2;

interface OpenverseResult {
	title: string;
	displayUrl: string;
	creator: string | null;
	license: string;
	licenseVersion: string | null;
	fromWikimedia: boolean;
}

export function personName(title: string): string {
	return title
		.replace(/\([^)]*\)/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function matchKey(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("fr-FR")
		.replace(/[^\p{L}\p{N}]/gu, "");
}

export function openverseSearchUrl(name: string): string {
	const params = new URLSearchParams({ q: name, page_size: String(PAGE_SIZE), license: ALLOWED_LICENSES.join(",") });
	return `https://api.openverse.org/v1/images/?${params.toString()}`;
}

function safeDecode(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return "";
	}
}

function displayUrlFor(url: string, thumbnail: unknown, fromWikimedia: boolean): string | null {
	const fileName = safeDecode(url.split("/").pop() ?? "");
	if (fromWikimedia && url.startsWith("https://upload.wikimedia.org/") && fileName) return commonsFileUrl(fileName);
	return typeof thumbnail === "string" && thumbnail.startsWith("https://") ? thumbnail : null;
}

function readResult(entry: unknown): OpenverseResult | null {
	if (!isRecord(entry)) return null;
	const { title, url, thumbnail, creator, license, license_version: licenseVersion, source } = entry;
	if (typeof title !== "string" || typeof url !== "string" || typeof license !== "string") return null;
	if (!(ALLOWED_LICENSES as readonly string[]).includes(license)) return null;
	const displayUrl = displayUrlFor(url, thumbnail, source === "wikimedia");
	if (!displayUrl) return null;
	return {
		title,
		displayUrl,
		creator: typeof creator === "string" && creator.length > 0 ? creator : null,
		license,
		licenseVersion: typeof licenseVersion === "string" ? licenseVersion : null,
		fromWikimedia: source === "wikimedia",
	};
}

function creditFor(result: OpenverseResult): string {
	const license = [result.license.toUpperCase(), result.licenseVersion].filter(Boolean).join(" ");
	return `Photo : ${result.creator ?? "auteur inconnu"}, licence ${license}, via Openverse`;
}

export function pickOpenverseImage(json: unknown, title: string): FoundImage | null {
	const nameKey = matchKey(personName(title));
	const results = isRecord(json) && Array.isArray(json.results) ? json.results : [];
	const best = results
		.map(readResult)
		.filter((result): result is OpenverseResult => result !== null && matchKey(result.title).includes(nameKey))
		.sort(
			(left, right) =>
				Number(right.fromWikimedia) - Number(left.fromWikimedia) || left.title.length - right.title.length,
		)[0];
	return best ? { url: best.displayUrl, credit: creditFor(best) } : null;
}

export async function findOpenverseImage(title: string, openverseApi: RequestQueue): Promise<FoundImage | null> {
	const name = personName(title);
	if (name.split(" ").length < MIN_NAME_WORDS) return null;
	return pickOpenverseImage(await openverseApi.getJson(openverseSearchUrl(name)), title);
}
