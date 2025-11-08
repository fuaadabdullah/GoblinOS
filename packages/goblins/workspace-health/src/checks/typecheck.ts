import { spawn } from "node:child_process";
export async function runTypecheck(): Promise<number> {
	return new Promise((res) => {
		const p = spawn(
			"pnpm",
			["-C", "GoblinOS", "build", "--workspace-concurrency=1"],
			{
				stdio: "inherit",
				shell: true,
			},
		);
		p.on("exit", (code: number | null) => res(code ?? 1));
	});
}
