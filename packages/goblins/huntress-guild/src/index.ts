import { GuildRegistryError, loadRegistrySync } from "@goblinos/registry";
import { createLogger, resolveRepoPath, runCommand } from "@goblinos/shared";
import { Command } from "commander";

const logger = createLogger({ name: "huntress-guild" });
const repoRoot = resolveRepoPath();

const registry = loadRegistrySync();
const guild = (() => {
	const value = registry.guildMap.get("huntress");
	if (!value) {
		throw new GuildRegistryError(
			"Huntress guild definition not found in goblins.yaml",
		);
	}
	return value;
})();

function getTool(toolId: string) {
	const tool = guild.toolMap.get(toolId);
	if (!tool) {
		throw new GuildRegistryError(
			`Tool ${toolId} is not registered for the Huntress guild`,
		);
	}
	return tool;
}

function splitCommand(command: string): { cmd: string; baseArgs: string[] } {
	const segments = command.split(" ").filter(Boolean);
	const baseCommand = segments[0];
	if (!baseCommand) {
		throw new GuildRegistryError("Huntress guild tool command is empty");
	}
	const baseArgs = segments.slice(1);
	return { cmd: baseCommand, baseArgs };
}

async function invokeTool(
	toolId: string,
	extraArgs: string[] = [],
	label?: string,
) {
	const tool = getTool(toolId);
	const { cmd, baseArgs } = splitCommand(tool.command as string);
	await runCommand(cmd, [...baseArgs, ...extraArgs], {
		cwd: repoRoot,
		logger,
		label: label ?? tool.name,
	});
}

function logToolbelt() {
	for (const tool of guild.toolbelt) {
		logger.info(
			{
				toolId: tool.id,
				command: tool.command,
				owner: tool.owner,
				args: tool.args,
			},
			tool.summary,
		);
	}
}

export function createProgram() {
	const program = new Command();

	program
		.name("huntress-guild")
		.description(
			"Huntress Guild CLI — Smoke probes, flaky extermination, and signal scouting",
		)
		.showHelpAfterError();

	program
		.command("smoke")
		.description(
			"Run platform smoke test (tools/smoke.sh) and report incidents",
		)
		.action(async () => {
			await invokeTool("kubecost-smoke", [], "Kubecost smoke probe");
		});

	program
		.command("tools")
		.description("List Huntress guild toolbelt assignments")
		.action(() => {
			logToolbelt();
		});

	program
		.command("signals:plan")
		.description("Preview upcoming signal scouting automation milestones")
		.action(() => {
			logger.info(
				"Signal scouting automations (log mining, trend surfacing) will be introduced in Phase 2 per the Guild Expansion Plan.",
			);
		});

	return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
	const program = createProgram();
	try {
		await program.parseAsync(argv);
	} catch (error) {
		logger.error(
			{ error: (error as Error).message },
			"Huntress guild command failed",
		);
		process.exit(1);
	}
}
