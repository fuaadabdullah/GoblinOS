import { run } from "./index.js";

// Run CLI and ensure any uncaught errors are logged and exit with non-zero status.
run(process.argv).catch((err) => {
	// eslint-disable-next-line no-console
	console.error("Unhandled error in keepers-guild CLI:", err);
	process.exit(1);
});
