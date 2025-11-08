import { Context } from "@temporalio/activity";
import axios from "axios";

const MEMORY_API_URL = process.env.MEMORY_API_URL || "http://localhost:8000";
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8001";

export interface Memory {
	id: string;
	content: string;
	importance: number;
	accessCount: number;
	tags: string[];
	metadata: Record<string, unknown>;
	createdAt: string;
}

export interface Candidates {
	shortTermToWorking: Memory[];
	workingToLongTerm: Memory[];
}

export interface ConsolidationParams {
	candidates: Memory[];
}

export interface ConsolidationResult {
	count: number;
}

export interface CleanupParams {
	maxAge: string; // e.g., '30d', '7d'
}

/**
 * Identify consolidation candidates across memory tiers.
 *
 * Short-term → Working criteria:
 * - importance >= 0.7
 * - accessCount >= 3
 *
 * Working → Long-term criteria:
 * - importance >= 0.9
 * - accessCount >= 10
 */
export async function identifyConsolidationCandidates(): Promise<Candidates> {
	const logger = Context.current().log;
	logger.info("Identifying consolidation candidates");

	try {
		// Fetch short-term memories
		const shortTermResponse = await axios.get(
			`${MEMORY_API_URL}/api/memory/short-term`,
		);
		const shortTermMemories: Memory[] = shortTermResponse.data;

		// Filter candidates for working memory
		const shortTermCandidates = shortTermMemories.filter(
			(m) => m.importance >= 0.7 && m.accessCount >= 3,
		);

		logger.info(
			`Found ${shortTermCandidates.length} short-term candidates for working memory`,
		);

		// Fetch working memories
		const workingResponse = await axios.get(
			`${MEMORY_API_URL}/api/memory/working`,
		);
		const workingMemories: Memory[] = workingResponse.data;

		// Filter candidates for long-term memory
		const workingCandidates = workingMemories.filter(
			(m) => m.importance >= 0.9 && m.accessCount >= 10,
		);

		logger.info(
			`Found ${workingCandidates.length} working candidates for long-term memory`,
		);

		return {
			shortTermToWorking: shortTermCandidates,
			workingToLongTerm: workingCandidates,
		};
	} catch (error) {
		logger.error("Failed to identify consolidation candidates", { error });
		throw error;
	}
}

/**
 * Consolidate memories from short-term to working tier.
 */
export async function consolidateToWorking(
	params: ConsolidationParams,
): Promise<ConsolidationResult> {
	const logger = Context.current().log;
	let consolidated = 0;

	for (const memory of params.candidates) {
		try {
			// Add to working memory with updated metadata
			await axios.post(`${MEMORY_API_URL}/api/memory/working`, {
				content: memory.content,
				importance: memory.importance,
				tags: memory.tags,
				metadata: {
					...memory.metadata,
					promotedAt: new Date().toISOString(),
					originalTier: "short-term",
					originalId: memory.id,
				},
			});

			// Remove from short-term
			await axios.delete(
				`${MEMORY_API_URL}/api/memory/short-term/${memory.id}`,
			);

			consolidated++;
			logger.info(`Consolidated memory ${memory.id} to working`, {
				importance: memory.importance,
				accessCount: memory.accessCount,
			});
		} catch (error) {
			logger.error(`Failed to consolidate ${memory.id}`, { error });
			// Continue with other memories
		}
	}

	logger.info(`Consolidated ${consolidated} memories to working tier`);
	return { count: consolidated };
}

/**
 * Consolidate memories from working to long-term tier.
 */
export async function consolidateToLongTerm(
	params: ConsolidationParams,
): Promise<ConsolidationResult> {
	const logger = Context.current().log;
	let consolidated = 0;

	for (const memory of params.candidates) {
		try {
			// Add to long-term memory with updated metadata
			await axios.post(`${MEMORY_API_URL}/api/memory/long-term`, {
				content: memory.content,
				importance: memory.importance,
				tags: memory.tags,
				metadata: {
					...memory.metadata,
					promotedAt: new Date().toISOString(),
					originalTier: "working",
					originalId: memory.id,
				},
			});

			// Remove from working memory
			await axios.delete(`${MEMORY_API_URL}/api/memory/working/${memory.id}`);

			consolidated++;
			logger.info(`Consolidated memory ${memory.id} to long-term`, {
				importance: memory.importance,
				accessCount: memory.accessCount,
			});
		} catch (error) {
			logger.error(`Failed to consolidate ${memory.id}`, { error });
			// Continue with other memories
		}
	}

	logger.info(`Consolidated ${consolidated} memories to long-term tier`);
	return { count: consolidated };
}

/**
 * Cleanup expired memories across all tiers.
 */
export async function cleanupExpiredMemories(
	params: CleanupParams,
): Promise<ConsolidationResult> {
	const logger = Context.current().log;
	logger.info("Cleaning up expired memories", { maxAge: params.maxAge });

	try {
		const response = await axios.post(`${MEMORY_API_URL}/api/memory/cleanup`, {
			maxAge: params.maxAge,
		});

		const count = response.data.deleted || 0;
		logger.info(`Cleaned up ${count} expired memories`);

		return { count };
	} catch (error) {
		logger.error("Failed to cleanup expired memories", { error });
		throw error;
	}
}

/**
 * Send notification about consolidation completion.
 */
export async function notifyConsolidationComplete(params: {
	shortTermConsolidated: number;
	longTermConsolidated: number;
	expired: number;
	duration: number;
}): Promise<void> {
	const logger = Context.current().log;

	logger.info("Consolidation complete", {
		shortTermConsolidated: params.shortTermConsolidated,
		longTermConsolidated: params.longTermConsolidated,
		expired: params.expired,
		duration: params.duration,
	});

	// In production, send to monitoring/alerting system
	// For now, attempt to POST to the backend notifications endpoint so the UI can surface an OS-level notification.
	try {
		const payload = {
			title: "Consolidation complete",
			body: `Short: ${params.shortTermConsolidated}, Long: ${params.longTermConsolidated}, Expired: ${params.expired} (duration: ${params.duration}ms)`,
			level: "info",
		};

		const headers: Record<string, string> = {};
		if (process.env.NOTIFICATIONS_SECRET) {
			headers["x-notify-secret"] = process.env.NOTIFICATIONS_SECRET;
		}

		await axios.post(`${BACKEND_API_URL}/api/notifications`, payload, {
			headers,
		});
	} catch (error) {
		logger.warn("Failed to POST consolidation notification", { error });
	}
}
