import { GuildRegistryError, loadRegistrySync } from "@goblinos/registry";
import { createLogger, resolveRepoPath, runCommand } from "@goblinos/shared";
import { Command } from "commander";

const logger = createLogger({ name: "mages-guild" });
const repoRoot = resolveRepoPath();

const registry = loadRegistrySync();
const guild = (() => {
	const value = registry.guildMap.get("mages");
	if (!value) {
		throw new GuildRegistryError(
			"Mages guild definition not found in goblins.yaml",
		);
	}
	return value;
})();

function getTool(toolId: string) {
	const tool = guild.toolMap.get(toolId);
	if (!tool) {
		throw new GuildRegistryError(
			`Tool ${toolId} is not registered for the Mages guild`,
		);
	}
	return tool;
}

function splitCommand(command: string): { cmd: string; baseArgs: string[] } {
	const segments = command.split(" ").filter(Boolean);
	const baseCommand = segments[0];
	if (!baseCommand) {
		throw new GuildRegistryError("Mages guild tool command is empty");
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

function listToolbelt() {
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
		.name("mages-guild")
		.description(
			"Mages Guild CLI — Forecasting, anomaly hunting, and quality gates",
		)
		.showHelpAfterError();

	program
		.command("quality:lint")
		.description("Run monorepo lint and security umbrella (tools/lint_all.sh)")
		.action(async () => {
			await invokeTool("lint-all", [], "Lint and quality suite");
		});

	program
		.command("quality:full")
		.description(
			"Alias for quality:lint (kept for parity with Overmind dashboards)",
		)
		.action(async () => {
			await invokeTool("lint-all", [], "Full quality gate suite");
		});

	program
		.command("vault:validate")
		.description(
			"Validate Forge knowledge vault integrity (tools/validate_forge_vault.sh)",
		)
		.action(async () => {
			await invokeTool("validate-vault", [], "Forge vault validation");
		});

	program
		.command("tools")
		.description("List Mages guild toolbelt assignments")
		.action(() => {
			listToolbelt();
		});

	program
		.command("roadmap")
		.description("Preview upcoming anomaly detection automation milestones")
		.action(() => {
			logger.info(
				"Anomaly and forecasting automations will integrate Smithy pipelines in Phase 2 with adaptive routing and KPI logging.",
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
			"Mages guild command failed",
		);
		process.exit(1);
	}
}
