import { GuildRegistryError, loadRegistrySync } from "@goblinos/registry";
import { createLogger, resolveRepoPath, runCommand } from "@goblinos/shared";
import { Command } from "commander";

const logger = createLogger({ name: "keepers-guild" });
const repoRoot = resolveRepoPath();

const registry = loadRegistrySync();
const guild = (() => {
	const value = registry.guildMap.get("keepers");
	if (!value) {
		throw new GuildRegistryError(
			"Keepers guild definition not found in goblins.yaml",
		);
	}
	return value;
})();

function getTool(toolId: string) {
	const tool = guild.toolMap.get(toolId);
	if (!tool) {
		throw new GuildRegistryError(
			`Tool ${toolId} is not registered for the Keepers guild`,
		);
	}
	return tool;
}

function splitCommand(command: string): { cmd: string; baseArgs: string[] } {
	const segments = command.split(" ").filter(Boolean);
	const baseCommand = segments[0];
	if (!baseCommand) {
		throw new GuildRegistryError("Keepers guild tool command is empty");
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
		.name("keepers-guild")
		.description(
			"Keepers Guild CLI — Secrets, SBOM integrity, and storage hygiene",
		)
		.showHelpAfterError();

	program
		.command("secrets:audit")
		.description("Audit API keys documentation and .env hygiene")
		.action(async () => {
			await invokeTool("api-keys-check", [], "API keys audit");
		});

	program
		.command("security:scan")
		.description("Run security compliance scan (Trivy, Cosign, SOPS)")
		.action(async () => {
			await invokeTool("security-check", [], "Security compliance scan");
		});

	program
		.command("secrets:playbook")
		.description("Open Smithy secrets management playbook")
		.action(async () => {
			await invokeTool("secrets-manage", [], "Secrets playbook");
		});

	program
		.command("storage:cleanup")
		.description("Weekly storage cleanup routine")
		.action(async () => {
			await invokeTool("storage-cleanup", [], "Storage cleanup");
		});

	program
		.command("storage:consolidate")
		.description("Run disk consolidation with archival safeguards")
		.action(async () => {
			await invokeTool("disk-consolidation", [], "Disk consolidation");
		});

	program
		.command("storage:space-saver")
		.description("Archive heavy caches and virtual environments")
		.action(async () => {
			await invokeTool("space-saver", [], "Space saver sweep");
		});

	program
		.command("system:clean")
		.description("Execute system-level cache purge with safety checks")
		.action(async () => {
			await invokeTool("system-clean", [], "System clean sweep");
		});

	program
		.command("tools")
		.description("List Keepers guild toolbelt assignments")
		.action(() => {
			listToolbelt();
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
			"Keepers guild command failed",
		);
		process.exit(1);
	}
}
