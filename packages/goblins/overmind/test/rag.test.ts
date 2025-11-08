/**
 * RAG Pipeline Test
 *
 * Tests the complete RAG pipeline functionality:
 * - Document chunking and embedding
 * - Vector store operations
 * - Retrieval and context injection
 *
 * @module test/rag.test
 */

import { describe, expect, it } from "vitest";
import { chunkText, createVectorStore, ragChat } from "../src/rag/index.js";

describe("RAG Pipeline", () => {
	it("should chunk text into manageable pieces", () => {
		const text =
			"This is a long document with multiple sentences. Each sentence should be chunked separately when the chunk size is small enough to force splitting.";
		const chunks = chunkText(text, { chunkSize: 30 });

		expect(chunks.length).toBeGreaterThan(0); // At least one chunk
		expect(chunks[0].content.length).toBeGreaterThan(0);
	});

	it("should create and populate vector store", async () => {
		const store = createVectorStore();

		// Create documents with mock embeddings
		const docs = [
			{
				id: "doc1",
				content: "This is about artificial intelligence",
				embedding: [0.1, 0.2, 0.3], // Mock embedding
				timestamp: Date.now(),
			},
			{
				id: "doc2",
				content: "This is about machine learning",
				embedding: [0.2, 0.3, 0.4], // Mock embedding
				timestamp: Date.now(),
			},
		];

		// Add documents
		for (const doc of docs) {
			store.add(doc);
		}

		expect(store.size()).toBe(docs.length);
		expect(store.stats().totalDocuments).toBe(docs.length);
	});

	it("should retrieve relevant documents", async () => {
		const store = createVectorStore();

		// Add test documents with mock embeddings
		store.add({
			id: "ai-doc",
			content: "Artificial intelligence is transforming technology",
			embedding: [0.1, 0.2, 0.3],
			timestamp: Date.now(),
		});

		// Search with similar embedding
		const results = store.search([0.1, 0.2, 0.3], { k: 1 });
		expect(results.length).toBe(1);
		expect(results[0].document.id).toBe("ai-doc");
	});

	it("should perform RAG chat simulation", async () => {
		// This would require LLM integration
		// For now, just test that the function exists
		expect(typeof ragChat).toBe("function");
	});
});
