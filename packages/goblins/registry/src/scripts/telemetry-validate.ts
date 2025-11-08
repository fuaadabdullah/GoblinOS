import { loadRegistrySync } from "../index.js";

function main() {
	const registry = loadRegistrySync();
	const issues: string[] = [];

	registry.guilds.forEach((guild) => {
		const fallbackModels = new Set<string>();

		guild.members.forEach((member) => {
			member.litebrain.local?.forEach((model) => fallbackModels.add(model));
			member.litebrain.routers?.forEach((router) => fallbackModels.add(router));
		});

		if (fallbackModels.size === 0) {
			issues.push(
				`Guild ${guild.id} has no fallback models defined across members`,
			);
		}

		guild.toolbelt.forEach((tool) => {
			if (!tool.command) {
				issues.push(`Guild ${guild.id} tool ${tool.id} is missing a command`);
			}

			tool.args?.forEach((arg) => {
				if (arg.type === "enum" && (!arg.options || arg.options.length === 0)) {
					issues.push(
						`Guild ${guild.id} tool ${tool.id} enum argument ${arg.name} is missing options`,
					);
				}
			});
		});

		const summary = `📊 ${guild.id} :: fallback=[${Array.from(fallbackModels).join(", ")}] tools=${guild.toolbelt.length}`;
		console.log(summary);
	});

	if (issues.length > 0) {
		console.error("Telemetry validation discovered issues:");
		for (const issue of issues) {
			console.error(` - ${issue}`);
		}
		process.exitCode = 1;
	} else {
		console.log("✅ Guild telemetry snapshot validated successfully");
	}
}

main();
