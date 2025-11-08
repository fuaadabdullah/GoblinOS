import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/consolidation";

/**
 * Temporal Worker for Overmind Memory Consolidation.
 *
 * Runs workflows and activities for:
 * - Memory consolidation (short-term → working → long-term)
 * - Expired memory cleanup
 * - Consolidation notifications
 */
async function run() {
	// Connect to Temporal server
	const connection = await NativeConnection.connect({
		address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
	});

	console.log("Connected to Temporal server");

	// Create worker
	const worker = await Worker.create({
		connection,
		namespace: process.env.TEMPORAL_NAMESPACE || "default",
		taskQueue: "overmind-memory",
		workflowsPath: require.resolve("./workflows"),
		activities,
		maxConcurrentActivityTaskExecutions: 10,
		maxConcurrentWorkflowTaskExecutions: 100,

		// Enable verbose logging in development
		debugMode: process.env.NODE_ENV !== "production",
	});

	console.log("Worker created. Starting...");
	console.log("Task queue: overmind-memory");
	console.log(`Namespace: ${process.env.TEMPORAL_NAMESPACE || "default"}`);
	console.log("Max concurrent activities: 10");
	console.log("Max concurrent workflows: 100");

	// Run worker
	await worker.run();
}

// Handle process signals
process.on("SIGINT", () => {
	console.log("Received SIGINT, shutting down gracefully...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("Received SIGTERM, shutting down gracefully...");
	process.exit(0);
});

// Start worker
run().catch((err) => {
	console.error("Worker failed:", err);
	process.exit(1);
});
