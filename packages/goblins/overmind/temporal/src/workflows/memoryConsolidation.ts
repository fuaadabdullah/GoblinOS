import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

/**
 * Proxy activities with retry policies and timeouts.
 */
const {
	identifyConsolidationCandidates,
	consolidateToWorking,
	consolidateToLongTerm,
	cleanupExpiredMemories,
	generateEmbeddings,
	notifyConsolidationComplete,
} = proxyActivities<typeof activities>({
	startToCloseTimeout: "5 minutes",
	retry: {
		initialInterval: "1s",
		maximumInterval: "30s",
		backoffCoefficient: 2,
		maximumAttempts: 3,
		nonRetryableErrorTypes: ["ValidationError"],
	},
});

export interface ConsolidationResult {
	shortTermConsolidated: number;
	longTermConsolidated: number;
	embeddingsGenerated: number;
	expired: number;
	timestamp: string;
	duration: number;
}

/**
 * Memory Consolidation Workflow
 *
 * Orchestrates the multi-tier memory consolidation process:
 * 1. Identify candidates in short-term and working memory
 * 2. Consolidate short-term → working (based on importance + access)
 * 3. Consolidate working → long-term (based on importance + access)
 * 4. Cleanup expired memories across all tiers
 *
 * Scheduled to run every 5 minutes via Temporal Schedule.
 */
export async function memoryConsolidation(): Promise<ConsolidationResult> {
	const startTime = Date.now();

	// Step 1: Identify consolidation candidates
	const candidates = await identifyConsolidationCandidates();

	// Step 2: Consolidate short-term → working memory
	// Criteria: importance >= 0.7, accessCount >= 3
	let shortTermCount = 0;
	if (candidates.shortTermToWorking.length > 0) {
		const workingResults = await consolidateToWorking({
			candidates: candidates.shortTermToWorking,
		});
		shortTermCount = workingResults.count;
	}

	// Add delay to avoid overwhelming the memory service
	if (shortTermCount > 0) {
		await sleep("2s");
	}

	// Step 3: Consolidate working → long-term memory
	// Criteria: importance >= 0.9, accessCount >= 10
	let longTermCount = 0;
	if (candidates.workingToLongTerm.length > 0) {
		const longTermResults = await consolidateToLongTerm({
			candidates: candidates.workingToLongTerm,
		});
		longTermCount = longTermResults.count;
	}

	// Step 3.5: Generate embeddings for newly consolidated long-term memories
	let embeddingsGenerated = 0;
	if (longTermCount > 0) {
		await sleep("2s");
		const embeddingResults = await generateEmbeddings({
			memories: candidates.workingToLongTerm,
			embeddingProvider: "ollama", // or "openai" based on config
		});
		embeddingsGenerated = embeddingResults.processed;
	}

	// Add delay before cleanup
	await sleep("1s");

	// Step 4: Cleanup expired memories
	// Remove memories older than 30 days (configurable)
	const cleanupResult = await cleanupExpiredMemories({
		maxAge: "30d",
	});

	const duration = Date.now() - startTime;

	// Step 5: Send notification if significant consolidation occurred
	if (shortTermCount + longTermCount > 10) {
		await notifyConsolidationComplete({
			shortTermConsolidated: shortTermCount,
			longTermConsolidated: longTermCount,
			embeddingsGenerated,
			expired: cleanupResult.count,
			duration,
		});
	}

	return {
		shortTermConsolidated: shortTermCount,
		longTermConsolidated: longTermCount,
		embeddingsGenerated,
		expired: cleanupResult.count,
		timestamp: new Date().toISOString(),
		duration,
	};
}
