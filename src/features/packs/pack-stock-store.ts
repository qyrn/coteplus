import { storage } from "wxt/utils/storage";
import { isPackStockState, type PackStockState } from "./pack-stock";

export const packStockItem = storage.defineItem<PackStockState | null>("local:pack-stock", { fallback: null });

export async function readPackStockState(): Promise<PackStockState | null> {
	const state = await packStockItem.getValue();
	return isPackStockState(state) ? state : null;
}
