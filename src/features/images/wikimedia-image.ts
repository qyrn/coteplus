import { isRecord } from "../../lib/json";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { FoundImage } from "./found-image";

const THUMBNAIL_WIDTH = 480;
const WIKIDATA_IMAGE_PROPERTIES = ["P18", "P154", "P41", "P94", "P242"] as const;
const WIKIDATA_ID_PATTERN = /^Q\d+$/;

export interface WikipediaPageImage {
	thumbnailUrl: string | null;
	wikidataId: string | null;
}

export function frenchWikipediaImageUrl(title: string): string {
	const params = new URLSearchParams({
		action: "query",
		prop: "pageimages|pageprops",
		titles: title,
		piprop: "thumbnail",
		pithumbsize: String(THUMBNAIL_WIDTH),
		pilicense: "free",
		ppprop: "wikibase_item",
		redirects: "1",
		format: "json",
		formatversion: "2",
		origin: "*",
	});
	return `https://fr.wikipedia.org/w/api.php?${params.toString()}`;
}

export function parseWikipediaPageImage(json: unknown): WikipediaPageImage {
	const pages = isRecord(json) && isRecord(json.query) && Array.isArray(json.query.pages) ? json.query.pages : [];
	const page: unknown = pages[0];
	if (!isRecord(page)) return { thumbnailUrl: null, wikidataId: null };
	const thumbnailUrl =
		isRecord(page.thumbnail) && typeof page.thumbnail.source === "string" ? page.thumbnail.source : null;
	const wikidataId = isRecord(page.pageprops) ? page.pageprops.wikibase_item : null;
	return {
		thumbnailUrl: thumbnailUrl?.startsWith("https://") ? thumbnailUrl : null,
		wikidataId: typeof wikidataId === "string" && WIKIDATA_ID_PATTERN.test(wikidataId) ? wikidataId : null,
	};
}

export function wikidataClaimsUrl(wikidataId: string): string {
	const params = new URLSearchParams({
		action: "wbgetentities",
		ids: wikidataId,
		props: "claims",
		format: "json",
		origin: "*",
	});
	return `https://www.wikidata.org/w/api.php?${params.toString()}`;
}

function readClaimFileName(claim: unknown): string | null {
	if (!isRecord(claim) || !isRecord(claim.mainsnak) || !isRecord(claim.mainsnak.datavalue)) return null;
	const fileName = claim.mainsnak.datavalue.value;
	return typeof fileName === "string" && fileName.length > 0 ? fileName : null;
}

export function pickWikidataImageFile(json: unknown, wikidataId: string): string | null {
	const entity = isRecord(json) && isRecord(json.entities) ? json.entities[wikidataId] : null;
	if (!isRecord(entity) || !isRecord(entity.claims)) return null;
	for (const property of WIKIDATA_IMAGE_PROPERTIES) {
		const propertyClaims = entity.claims[property];
		const fileName = Array.isArray(propertyClaims) ? readClaimFileName(propertyClaims[0]) : null;
		if (fileName) return fileName;
	}
	return null;
}

export function commonsFileUrl(fileName: string): string {
	const encodedName = encodeURIComponent(fileName.replaceAll(" ", "_"));
	return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}?width=${THUMBNAIL_WIDTH}`;
}

export async function findWikimediaImage(title: string, wikimediaApi: RequestQueue): Promise<FoundImage | null> {
	const page = parseWikipediaPageImage(await wikimediaApi.getJson(frenchWikipediaImageUrl(title)));
	if (page.thumbnailUrl) return { url: page.thumbnailUrl, credit: null };
	if (!page.wikidataId) return null;
	const claims = await wikimediaApi.getJson(wikidataClaimsUrl(page.wikidataId));
	const fileName = pickWikidataImageFile(claims, page.wikidataId);
	return fileName ? { url: commonsFileUrl(fileName), credit: null } : null;
}
