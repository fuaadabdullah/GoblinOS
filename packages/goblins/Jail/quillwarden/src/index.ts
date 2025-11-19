import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { extname, join } from "path";

type Goblin = {
	name: string;
	run(args: Record<string, unknown>): Promise<number>;
	health?: () => Promise<string>;
};

interface FrontmatterIssue {
	file: string;
	issue: string;
}

interface LinguistIssue {
	file: string;
	issue: string;
}

export default function make(opts: Record<string, unknown>): Goblin {
	return {
		name: "quillwarden",
		async run() {
			const fix = opts?.fix === true || opts?.fix === "true";
			const vaultPath =
				(opts?.vaultPath as string) ||
				process.env.OBSIDIAN_VAULT_PATH ||
				"/Users/fuaadabdullah/ForgeMonorepo";

			console.log(
				`[quillwarden] 🔍 Scanning Obsidian vault${fix ? " and fixing issues" : ""}...`,
			);
			console.log(`[quillwarden] 📁 Vault path: ${vaultPath}`);

			try {
				const frontmatterIssues = await checkFrontmatterHeaders(vaultPath);
				const linguistIssues = await checkLinguistAttributes(vaultPath);

				console.log(
					`[quillwarden] 📝 Found ${frontmatterIssues.length} frontmatter issues`,
				);
				console.log(
					`[quillwarden] 🏷️  Found ${linguistIssues.length} linguist issues`,
				);

				let fixedCount = 0;

				if (fix) {
					fixedCount += await fixFrontmatterIssues(
						vaultPath,
						frontmatterIssues,
					);
					fixedCount += await fixLinguistIssues(vaultPath, linguistIssues);
					console.log(`[quillwarden] 🔧 Fixed ${fixedCount} issues`);
				} else {
					// Report issues
					if (frontmatterIssues.length > 0) {
						console.log("\n❌ Frontmatter Issues:");
						frontmatterIssues.forEach((issue) => {
							console.log(`  ${issue.file}: ${issue.issue}`);
						});
					}

					if (linguistIssues.length > 0) {
						console.log("\n❌ Linguist Issues:");
						linguistIssues.forEach((issue) => {
							console.log(`  ${issue.file}: ${issue.issue}`);
						});
					}
				}

				const totalIssues =
					frontmatterIssues.length + linguistIssues.length - fixedCount;
				if (totalIssues === 0) {
					console.log("[quillwarden] ✅ Vault is compliant!");
					return 0;
				} else {
					console.log(
						`[quillwarden] ⚠️  ${totalIssues} issues remain${fix ? " (some may need manual review)" : ""}`,
					);
					return 1;
				}
			} catch (error) {
				console.error("[quillwarden] ❌ Error:", error);
				return 1;
			}
		},
	};
}

async function checkFrontmatterHeaders(
	vaultPath: string,
): Promise<FrontmatterIssue[]> {
	const issues: FrontmatterIssue[] = [];
	const markdownFiles = findMarkdownFiles(vaultPath);

	for (const file of markdownFiles) {
		try {
			const content = readFileSync(file, "utf-8");
			const relativePath = file.replace(vaultPath + "/", "");

			// Check if file has YAML frontmatter
			if (!content.startsWith("---")) {
				issues.push({
					file: relativePath,
					issue: "Missing YAML frontmatter (should start with ---)",
				});
				continue;
			}

			// Find the end of frontmatter
			const endIndex = content.indexOf("\n---", 3);
			if (endIndex === -1) {
				issues.push({
					file: relativePath,
					issue: "YAML frontmatter not properly closed with ---",
				});
				continue;
			}

			// Parse frontmatter
			const frontmatter = content.substring(3, endIndex);
			const frontmatterLines = frontmatter.trim().split("\n");

			// Check for required fields based on file type/location
			const requiredFields = getRequiredFrontmatterFields(relativePath);
			for (const field of requiredFields) {
				const hasField = frontmatterLines.some((line) =>
					line.startsWith(`${field}:`),
				);
				if (!hasField) {
					issues.push({
						file: relativePath,
						issue: `Missing required frontmatter field: ${field}`,
					});
				}
			}
		} catch (error) {
			issues.push({
				file: file.replace(vaultPath + "/", ""),
				issue: `Error reading file: ${error}`,
			});
		}
	}

	return issues;
}

async function checkLinguistAttributes(
	vaultPath: string,
): Promise<LinguistIssue[]> {
	const issues: LinguistIssue[] = [];

	// Check .gitattributes file for linguist overrides
	const gitattributesPath = join(vaultPath, ".gitattributes");
	try {
		const gitattributes = readFileSync(gitattributesPath, "utf-8");
		const lines = gitattributes.split("\n");

		// Check for common linguist patterns that should be set
		const expectedPatterns = [
			"*.md linguist-detectable=true",
			"docs/** linguist-documentation=false",
			"*.template.md linguist-generated=true",
		];

		for (const pattern of expectedPatterns) {
			const hasPattern = lines.some((line) => line.trim() === pattern);
			if (!hasPattern) {
				issues.push({
					file: ".gitattributes",
					issue: `Missing linguist attribute: ${pattern}`,
				});
			}
		}
	} catch (error) {
		issues.push({
			file: ".gitattributes",
			issue: "File not found or unreadable",
		});
	}

	return issues;
}

function getRequiredFrontmatterFields(filePath: string): string[] {
	// Define required fields based on file location/type
	if (filePath.includes("📋 Projects/")) {
		return ["description", "tags"];
	}
	if (filePath.includes("🔄 Workflows/")) {
		return ["description", "category", "status"];
	}
	if (filePath.includes("📊 Dashboards/")) {
		return ["description", "dashboard-type"];
	}
	if (filePath.includes("📈 Metrics/")) {
		return ["description", "metric-type", "unit"];
	}

	// Default required fields for all markdown files
	return ["description"];
}

async function fixFrontmatterIssues(
	vaultPath: string,
	issues: FrontmatterIssue[],
): Promise<number> {
	let fixed = 0;

	for (const issue of issues) {
		const filePath = join(vaultPath, issue.file);

		try {
			if (issue.issue.includes("Missing YAML frontmatter")) {
				await addFrontmatterToFile(filePath, issue.file);
				fixed++;
				console.log(`  ✅ Added frontmatter to ${issue.file}`);
			} else if (issue.issue.includes("Missing required frontmatter field")) {
				await addMissingFieldToFile(filePath, issue.file, issue.issue);
				fixed++;
				console.log(`  ✅ Added missing field to ${issue.file}`);
			}
			// Note: Other issues like malformed frontmatter need manual review
		} catch (error) {
			console.log(`  ❌ Failed to fix ${issue.file}: ${error}`);
		}
	}

	return fixed;
}

async function fixLinguistIssues(
	vaultPath: string,
	_issues: LinguistIssue[],
): Promise<number> {
	let fixed = 0;
	const gitattributesPath = join(vaultPath, ".gitattributes");

	try {
		let content = "";
		try {
			content = readFileSync(gitattributesPath, "utf-8");
		} catch {
			// File doesn't exist, create it
			content = "";
		}

		const lines = content.split("\n").filter((line) => line.trim() !== "");

		// Add missing linguist attributes
		const attributesToAdd = [
			"*.md linguist-detectable=true",
			"docs/** linguist-documentation=false",
			"*.template.md linguist-generated=true",
		];

		for (const attr of attributesToAdd) {
			if (!lines.includes(attr)) {
				lines.push(attr);
				fixed++;
				console.log(`  ✅ Added linguist attribute: ${attr}`);
			}
		}

		if (fixed > 0) {
			writeFileSync(gitattributesPath, lines.join("\n") + "\n");
		}
	} catch (error) {
		console.log(`  ❌ Failed to update .gitattributes: ${error}`);
	}

	return fixed;
}

async function addFrontmatterToFile(
	filePath: string,
	relativePath: string,
): Promise<void> {
	const content = readFileSync(filePath, "utf-8");
	const requiredFields = getRequiredFrontmatterFields(relativePath);

	let frontmatter = "---\n";
	for (const field of requiredFields) {
		const defaultValue = getDefaultValueForField(field, relativePath);
		frontmatter += `${field}: ${defaultValue}\n`;
	}
	frontmatter += "---\n\n";

	const newContent = frontmatter + content;
	writeFileSync(filePath, newContent);
}

async function addMissingFieldToFile(
	filePath: string,
	relativePath: string,
	issue: string,
): Promise<void> {
	const fieldMatch = issue.match(/Missing required frontmatter field: (\w+)/);
	if (!fieldMatch) return;

	const field = fieldMatch[1];
	const content = readFileSync(filePath, "utf-8");

	// Find frontmatter section
	const startIndex = content.indexOf("---");
	const endIndex = content.indexOf("\n---", 3);
	if (startIndex === -1 || endIndex === -1) return;

	const frontmatter = content.substring(startIndex + 3, endIndex);
	const defaultValue = getDefaultValueForField(field, relativePath);

	const newFrontmatter = frontmatter.trim() + `\n${field}: ${defaultValue}\n`;
	const newContent = content.replace(frontmatter, newFrontmatter);

	writeFileSync(filePath, newContent);
}

function getDefaultValueForField(field: string, filePath: string): string {
	switch (field) {
		case "description":
			return `"${filePath.split("/").pop()?.replace(".md", "") || "Document"}"`;
		case "tags":
			return "[]";
		case "category":
			return `"${filePath.includes("Workflows") ? "workflow" : "general"}"`;
		case "status":
			return `"draft"`;
		case "dashboard-type":
			return `"overview"`;
		case "metric-type":
			return `"counter"`;
		case "unit":
			return `"count"`;
		default:
			return `""`;
	}
}

function findMarkdownFiles(dirPath: string): string[] {
	const files: string[] = [];

	function scanDir(currentPath: string) {
		try {
			const items = readdirSync(currentPath);

			for (const item of items) {
				const fullPath = join(currentPath, item);
				const stat = statSync(fullPath);

				if (
					stat.isDirectory() &&
					!item.startsWith(".") &&
					item !== "node_modules"
				) {
					scanDir(fullPath);
				} else if (stat.isFile() && extname(item) === ".md") {
					files.push(fullPath);
				}
			}
		} catch (error) {
			// Skip directories we can't read
		}
	}

	scanDir(dirPath);
	return files;
}

// For standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
	// Parse command line arguments
	const args = process.argv.slice(2);
	const parsedOpts: Record<string, unknown> = {};

	for (const arg of args) {
		const [key, value] = arg.split("=");
		if (key && value) {
			parsedOpts[key] =
				value === "true" ? true : value === "false" ? false : value;
		}
	}

	const goblin = make(parsedOpts);
	goblin
		.run(parsedOpts)
		.then((code) => {
			process.exit(code);
		})
		.catch((error) => {
			console.error("Error:", error);
			process.exit(1);
		});
}
