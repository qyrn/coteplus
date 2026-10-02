export function isBattleRoute(pathname: string): boolean {
	return pathname === "/battle" || pathname.startsWith("/battle/");
}
