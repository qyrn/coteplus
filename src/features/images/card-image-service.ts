import { CACHE_NAMESPACES } from "../../lib/cache/namespaces";
import { createTtlStore } from "../../lib/cache/ttl-store";
import type { RequestQueue } from "../../lib/net/request-queue";
import { findFreeImage } from "./wikimedia-image";

const DAY_MS = 24 * 60 * 60 * 1000;
const FOUND_IMAGE_TTL_MS = 30 * DAY_MS;
const MISSING_IMAGE_TTL_MS = 7 * DAY_MS;

interface ImageLookup {
	url: string | null;
}

export interface CardImageService {
	findImage(title: string): Promise<string | null>;
}

export function createCardImageService(wikimediaApi: RequestQueue): CardImageService {
	const imageStore = createTtlStore<ImageLookup>(CACHE_NAMESPACES.cardImage);
	const inFlight = new Map<string, Promise<string | null>>();

	async function lookup(title: string): Promise<string | null> {
		const cached = await imageStore.get(title);
		if (cached) return cached.value.url;
		const url = await findFreeImage(title, wikimediaApi);
		await imageStore.set(title, { url }, url ? FOUND_IMAGE_TTL_MS : MISSING_IMAGE_TTL_MS);
		return url;
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
