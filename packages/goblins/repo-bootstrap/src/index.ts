import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
type Goblin = {
	name: string;
	run(args: Record<string, unknown>): Promise<number>;
	health?: () => Promise<string>;
};

export default function make(opts: Record<string, unknown>): Goblin {
	return {
		name: "repo-bootstrap",
		async run() {
			// ensure pnpm
			const ensurePnpm = (
				opts && typeof opts === "object" ? opts.ensurePnpm : undefined
			) as unknown;
			if (ensurePnpm) {
				try {
					execSync("pnpm -v", { stdio: "ignore" });
				} catch {
					throw new Error("pnpm not found. Install pnpm 9.");
				}
			}
			// node version
			const requiredNode = (
				opts && typeof opts === "object" ? opts.requiredNode : undefined
			) as unknown;
			if (requiredNode) {
				const v = process.versions.node.split(".")[0];
				const req = String(requiredNode);
				if (Number(v) < Number(req)) throw new Error(`Node ${req}+ required`);
			}
			// git hooks
			const hooks = path.resolve(process.cwd(), ".git/hooks");
			if (fs.existsSync(".git") && fs.existsSync(hooks)) {
				fs.writeFileSync(
					path.join(hooks, "pre-commit"),
					"#!/usr/bin/env bash\npnpm -C GoblinOS check || exit 1\n",
				);
				fs.chmodSync(path.join(hooks, "pre-commit"), 0o755);
				console.log("[bootstrap] pre-commit installed");
			}
			console.log("[bootstrap] ok");
			return 0;
		},
	};
}
