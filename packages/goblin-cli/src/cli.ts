#!/usr/bin/env node
import { GoblinRuntime } from "@goblinos/goblin-runtime";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

const program = new Command();

program
	.name("goblin")
	.description("GoblinOS CLI - Execute tasks with specialized AI goblins")
	.version("0.1.0");

program
	.command("ask")
	.description("Ask a goblin to perform a task")
	.argument("<goblin>", "Goblin ID (e.g., vanta-lumin, dregg-embercode)")
	.argument("<task>", "Task description")
	.option("--dry-run", "Preview without executing tools")
	.option("--no-color", "Disable colored output")
	.option("--json", "Output as JSON")
	.action(async (goblin, task, options) => {
		const spinner = ora(`Asking ${goblin}...`).start();

		try {
			const runtime = new GoblinRuntime();
			await runtime.initialize();

			spinner.text = `${goblin} is thinking...`;

			const response = await runtime.executeTask({
				goblin,
				task,
				dryRun: options.dryRun,
			});

			spinner.stop();

			if (options.json) {
				console.log(JSON.stringify(response, null, 2));
				runtime.close();
				return;
			}

			console.log(chalk.bold.cyan(`\n🤖 ${goblin}`));
			console.log(chalk.gray("─".repeat(60)));
			console.log(chalk.white(`Task: ${task}`));
			console.log();

			if (response.success) {
				console.log(chalk.green("✅ Success"));
			} else {
				console.log(chalk.red("❌ Failed"));
			}

			console.log();
			console.log(chalk.white("Response:"));
			console.log(response.reasoning);

			if (response.tool) {
				console.log();
				console.log(chalk.yellow(`🔧 Tool: ${response.tool}`));
				console.log(chalk.gray(`Command: ${response.command}`));

				if (response.output && !options.dryRun) {
					console.log();
					console.log(chalk.blue("Output:"));
					// Truncate long output
					const output =
						response.output.length > 500
							? response.output.substring(0, 500) + "\n... (truncated)"
							: response.output;
					console.log(output);
				}
			}

			if (response.kpis) {
				console.log();
				console.log(chalk.magenta("📊 KPIs:"));
				for (const [key, value] of Object.entries(response.kpis)) {
					console.log(chalk.gray(`  ${key}: ${value}`));
				}
			}

			console.log();
			console.log(chalk.gray(`⏱️  Completed in ${response.duration_ms}ms`));

			runtime.close();
		} catch (error: any) {
			spinner.fail(chalk.red(`Error: ${error.message}`));
			process.exit(1);
		}
	});

program
	.command("history")
	.description("View a goblin's task history")
	.argument("<goblin>", "Goblin ID")
	.option("-n, --limit <number>", "Number of entries to show", "10")
	.action(async (goblin, options) => {
		const runtime = new GoblinRuntime();
		await runtime.initialize();

		const history = runtime.getGoblinHistory(
			goblin,
			Number.parseInt(options.limit),
		);

		if (history.length === 0) {
			console.log(chalk.yellow(`No history found for ${goblin}`));
			runtime.close();
			return;
		}

		console.log(chalk.bold.cyan(`\n📜 History for ${goblin}\n`));

		for (const entry of history) {
			console.log(chalk.gray("─".repeat(60)));
			console.log(chalk.white(`Task: ${entry.task}`));
			console.log(chalk.gray(`Time: ${entry.timestamp.toLocaleString()}`));
			console.log(
				chalk.gray(`Status: ${entry.success ? "✅ Success" : "❌ Failed"}`),
			);
			console.log();

			const preview = entry.response.substring(0, 150);
			console.log(preview + (entry.response.length > 150 ? "..." : ""));
			console.log();
		}

		runtime.close();
	});

program
	.command("list")
	.description("List all available goblins")
	.action(async () => {
		const runtime = new GoblinRuntime();
		await runtime.initialize();

		const goblins = runtime.listGoblins();

		console.log(chalk.bold.cyan("\n🧙 Available Goblins\n"));

		for (const goblin of goblins) {
			console.log(chalk.bold.white(goblin.title));
			console.log(chalk.gray(`  ID: ${goblin.id}`));
			console.log(chalk.gray(`  Guild: ${goblin.guild}`));

			if (goblin.responsibilities && goblin.responsibilities.length > 0) {
				console.log(chalk.gray(`  Responsibilities:`));
				for (const resp of goblin.responsibilities.slice(0, 2)) {
					console.log(chalk.gray(`    • ${resp}`));
				}
			}
			console.log();
		}

		console.log(
			chalk.yellow('Run "goblin ask <goblin-id> <task>" to get started\n'),
		);

		runtime.close();
	});

program
	.command("stats")
	.description("View a goblin's performance statistics")
	.argument("<goblin>", "Goblin ID")
	.action(async (goblin) => {
		const runtime = new GoblinRuntime();
		await runtime.initialize();

		const stats = runtime.getGoblinStats(goblin);

		console.log(chalk.bold.cyan(`\n📊 Stats for ${goblin}\n`));
		console.log(
			chalk.white(`Success Rate (24h): ${stats.successRate.toFixed(1)}%`),
		);
		console.log(chalk.white(`Recent Tasks: ${stats.recentTasks.length}`));

		if (stats.recentTasks.length > 0) {
			console.log();
			console.log(chalk.gray("Last 5 tasks:"));
			for (const task of stats.recentTasks) {
				const status = task.success ? chalk.green("✓") : chalk.red("✗");
				console.log(`  ${status} ${task.task}`);
			}
		}

		console.log();
		runtime.close();
	});

program.parse();
