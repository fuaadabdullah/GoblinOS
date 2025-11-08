import { spawn } from "node:child_process";
export async function runTests(): Promise<number> {
	return new Promise((res) => {
		const p = spawn("pnpm", ["-C", "GoblinOS", "test"], {
			stdio: "inherit",
			shell: true,
		});
		p.on("exit", (code: number | null) => res(code ?? 1));
	});
}
