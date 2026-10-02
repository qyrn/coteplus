import { isRecord } from "../../lib/json";
import type { PackStockReading } from "./pack-stock";

export type PackStockMessage =
	| { type: "pack-stock/read"; reading: PackStockReading; readAt: number }
	| { type: "pack-stock/signed-out" };

function isPackStockReading(value: unknown): value is PackStockReading {
	return (
		isRecord(value) &&
		Number.isInteger(value.stock) &&
		Number.isInteger(value.maxStock) &&
		(value.nextPackInMs === null || typeof value.nextPackInMs === "number") &&
		(value.isPro === null || typeof value.isPro === "boolean")
	);
}

export function isPackStockMessage(value: unknown): value is PackStockMessage {
	if (!isRecord(value)) return false;
	if (value.type === "pack-stock/signed-out") return true;
	return value.type === "pack-stock/read" && typeof value.readAt === "number" && isPackStockReading(value.reading);
}
