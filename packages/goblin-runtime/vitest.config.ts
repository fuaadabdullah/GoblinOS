import os from "os";
import path from "path";
import { defineConfig } from "vitest/config";

// Override TMPDIR to use local directory instead of external volume
process.env.TMPDIR = os.tmpdir();

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.{idea,git,cache,output,temp}/**",
		],
	},
	cacheDir: path.join(__dirname, ".vitest-cache"),
});
