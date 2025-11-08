export const guildPalette = {
	Forge: "#ef4444",
	Crafters: "#3b82f6",
	Huntress: "#10b981",
	Keepers: "#f59e0b",
	Mages: "#8b5cf6",
};
export function getGuildColor(guild, idx = 0) {
	if (guild && guildPalette[guild]) return guildPalette[guild];
	const fallbacks = [
		"#ef4444",
		"#3b82f6",
		"#10b981",
		"#f59e0b",
		"#8b5cf6",
		"#06b6d4",
	];
	return fallbacks[idx % fallbacks.length];
}
