import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
	},
	resolve: {
		alias: {
			"@goblinos/overmind": resolve(__dirname, "../dist/index.js"),
		},
	},
});
