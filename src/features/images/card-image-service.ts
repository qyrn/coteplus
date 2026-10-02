import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestQueue } from "../../lib/net/request-queue";
import type { FoundImage } from "./found-image";
import { findOpenverseImage } from "./openverse-image";
import { findWikimediaImage } from "./wikimedia-image";

const DAY_MS = 24 * 60 * 60 * 1000;
const FOUND_IMAGE_TTL_MS = 30 * DAY_MS;
const MISSING_IMAGE_TTL_MS = 7 * DAY_MS;

interface ImageLookup {
	image: FoundImage | null;
}

export interface ImageSources {
	wikimediaApi: RequestQueue;
	openverseApi: RequestQueue;
}

export interface CardImageService {
	findImage(title: string): Promise<FoundImage | null>;
}

export function createCardImageService(sources: ImageSources): CardImageService {
	const imageStore = createTtlStore<ImageLookup>(CACHE_NAMESPACES.cardImage);
	const inFlight = new Map<string, Promise<FoundImage | null>>();

	async function lookup(title: string): Promise<FoundImage | null> {
		const cached = await imageStore.get(title);
		if (cached) return cached.value.image;
		const image =
			(await findWikimediaImage(title, sources.wikimediaApi)) ??
			(await findOpenverseImage(title, sources.openverseApi));
		await imageStore.set(title, { image }, image ? FOUND_IMAGE_TTL_MS : MISSING_IMAGE_TTL_MS);
		return image;
	}

	return {
		findImage(title) {
			const existing = inFlight.get(title);
			if (existing) return existing;
			const finding = lookup(title).finally(() => inFlight.delete(title));
			inFlight.set(title, finding);
			return finding;
		},
	};
}
