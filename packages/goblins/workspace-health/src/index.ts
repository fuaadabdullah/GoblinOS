type Goblin = {
	name: string;
	run(args: Record<string, unknown>): Promise<number>;
	health?: () => Promise<string>;
};

import { runEslint } from "./checks/eslint.js";
import { runSmoke } from "./checks/smoke.js";
import { runTests } from "./checks/tests.js";
import { runTypecheck } from "./checks/typecheck.js";

export default function make(opts: Record<string, unknown>): Goblin {
	return {
		name: "workspace-health",
		async run() {
			const smokeUrl = (
				opts && typeof opts === "object" ? opts.smokeUrl : undefined
			) as unknown;
			const results = await Promise.all([
				runEslint(),
				runTypecheck(),
				runTests(),
				runSmoke(typeof smokeUrl === "string" ? smokeUrl : undefined),
			]);
			const bad = results.find((r: number) => r !== 0);
			console.log("[health] done");
			return bad ? 1 : 0;
		},
	};
}
