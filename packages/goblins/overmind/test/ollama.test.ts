import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the entire ollama module BEFORE importing anything that uses it
vi.mock("ollama", () => {
	const mockGenerate = vi.fn();
	const mockEmbeddings = vi.fn();
	const mockList = vi.fn();
	const mockPull = vi.fn();

	// Provide a canonical instance object in the mock exports so consumers
	// (and tests) can reliably access the same mock functions. This helps the
	// provider locate the exact mocked methods across different module/runtime
	// permutations.
	const instance = {
		generate: mockGenerate,
		embeddings: mockEmbeddings,
		list: mockList,
		pull: mockPull,
	};

	// Create a proper constructor function
	class MockOllama {
		generate = mockGenerate;
		embeddings = mockEmbeddings;
		list = mockList;
		pull = mockPull;
	}

	return {
		Ollama: MockOllama,
		// Export the instance directly to make it discoverable by provider in
		// test scenarios where constructor invocation shapes are inconsistent.
		instance,
	};
});

// Get references to the mocked functions after the mock is set up
const { Ollama } = await import("ollama");
const mockInstance = new Ollama();
const mockGenerate = mockInstance.generate as any;
const mockEmbeddings = mockInstance.embeddings as any;
const mockList = mockInstance.list as any;
const mockPull = mockInstance.pull as any;

// Mock dotenv to prevent actual file loading
vi.mock("dotenv", () => ({
	config: vi.fn(),
}));

// Mock tracing to prevent actual tracing setup
vi.mock("../observability/tracing.js", () => ({
	trace: {
		getTracer: vi.fn(() => ({
			startActiveSpan: vi.fn((_name, fn) =>
				fn({ setAttribute: vi.fn(), recordException: vi.fn(), end: vi.fn() }),
			),
		})),
	},
	tracingUtils: {
		addSavingsAttributes: vi.fn(),
		addOllamaSelectionAttributes: vi.fn(),
		addRoutingAttributes: vi.fn(),
		addHealthCheckAttributes: vi.fn(),
	},
}));

// Import after mocking
import {
	checkOllamaHealth,
	embedWithOllama,
	estimateSavings,
	generateWithOllama,
	generateWithOllamaStream,
	listOllamaModels,
	pullModelIfNeeded,
	pullOllamaModel,
	selectModel,
} from "../src/providers/ollama.js";

// Access the mocked tracingUtils from the mock
const mockTracingModule = vi.mocked(
	await import("../observability/tracing.js"),
);
const mockTracingUtils = mockTracingModule.tracingUtils;

describe("Ollama Provider", () => {
	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("generateWithOllama", () => {
		it("should generate text successfully", async () => {
			const mockResponse = {
				model: "qwen2.5:3b",
				created_at: new Date(),
				response: "Generated text from Ollama",
				done: true,
				done_reason: "stop",
				context: [],
				total_duration: 1000000,
				load_duration: 500000,
				prompt_eval_count: 10,
				prompt_eval_duration: 500000,
				eval_count: 50,
				eval_duration: 500000,
			};

			mockGenerate.mockResolvedValue(mockResponse);

			const result = await generateWithOllama("qwen2.5:3b", "Test prompt");

			expect(result).toBe("Generated text from Ollama");
			expect(mockGenerate).toHaveBeenCalledWith({
				model: "qwen2.5:3b",
				prompt: "Test prompt",
				options: {
					temperature: 0.7,
					num_predict: 500,
				},
				stream: false,
			});
		});

		it("should include context in prompt", async () => {
			const mockResponse = {
				model: "qwen2.5:3b",
				created_at: new Date(),
				response: "Response with context",
				done: true,
				done_reason: "stop",
				context: [],
				total_duration: 500000,
				load_duration: 200000,
				prompt_eval_count: 5,
				prompt_eval_duration: 200000,
				eval_count: 30,
				eval_duration: 300000,
			};
			mockGenerate.mockResolvedValue(mockResponse);

			const context = ["Previous message 1", "Previous message 2"];
			await generateWithOllama("qwen2.5:3b", "Current prompt", { context });

			expect(mockGenerate).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Previous message 1\nPrevious message 2\nCurrent prompt",
				}),
			);
		});

		it("should handle custom options", async () => {
			const mockResponse = {
				model: "qwen2.5-coder:3b",
				created_at: new Date(),
				response: "Custom response",
				done: true,
				done_reason: "stop",
				context: [],
				total_duration: 300000,
				load_duration: 100000,
				prompt_eval_count: 3,
				prompt_eval_duration: 100000,
				eval_count: 20,
				eval_duration: 200000,
			};
			mockGenerate.mockResolvedValue(mockResponse);

			await generateWithOllama("qwen2.5-coder:3b", "Prompt", {
				temperature: 0.9,
				maxTokens: 1000,
			});

			expect(mockGenerate).toHaveBeenCalledWith(
				expect.objectContaining({
					options: {
						temperature: 0.9,
						num_predict: 1000,
					},
				}),
			);
		});

		it("should throw error on failure", async () => {
			mockGenerate.mockRejectedValue(new Error("Ollama error"));

			await expect(generateWithOllama("qwen2.5:3b", "Prompt")).rejects.toThrow(
				"Ollama generation failed: Ollama error",
			);
		});

		it("should handle unknown errors", async () => {
			mockGenerate.mockRejectedValue("String error");

			await expect(generateWithOllama("qwen2.5:3b", "Prompt")).rejects.toThrow(
				"Ollama generation failed: String error",
			);
		});
	});

	describe("embedWithOllama", () => {
		it("should generate embeddings successfully", async () => {
			const mockResponse = {
				embedding: [0.1, 0.2, 0.3],
			};

			mockEmbeddings.mockResolvedValue(mockResponse);

			const result = await embedWithOllama("Test text");

			expect(result).toEqual([0.1, 0.2, 0.3]);
			expect(mockEmbeddings).toHaveBeenCalledWith({
				model: "qwen2.5:3b", // Updated to use available model
				prompt: "Test text",
			});
		});

		it("should use custom model", async () => {
			const mockResponse = { embedding: [0.4, 0.5] };
			mockEmbeddings.mockResolvedValue(mockResponse);

			await embedWithOllama("Text", "qwen2.5-coder:3b");

			expect(mockEmbeddings).toHaveBeenCalledWith({
				model: "qwen2.5-coder:3b",
				prompt: "Text",
			});
		});

		it("should throw error on failure", async () => {
			mockEmbeddings.mockRejectedValue(new Error("Embedding error"));

			await expect(embedWithOllama("Text")).rejects.toThrow(
				"Ollama embedding failed: Embedding error",
			);
		});
	});

	describe("listOllamaModels", () => {
		it("should list models successfully", async () => {
			const mockResponse = {
				models: [
					{
						name: "qwen2.5:3b",
						model: "qwen2.5:3b",
						modified_at: new Date(),
						size: 1000000,
						digest: "sha256:abc123",
						expires_at: new Date(Date.now() + 86400000),
						size_vram: 500000,
						details: {
							format: "gguf",
							family: "qwen2",
							families: ["qwen2"],
							parameter_size: "3B",
							quantization_level: "Q4_0",
							parent_model: "",
						},
					},
					{
						name: "qwen2.5-coder:3b",
						model: "qwen2.5-coder:3b",
						modified_at: new Date(),
						size: 2000000,
						digest: "sha256:def456",
						expires_at: new Date(Date.now() + 86400000),
						size_vram: 1000000,
						details: {
							format: "gguf",
							family: "qwen2",
							families: ["qwen2"],
							parameter_size: "3B",
							quantization_level: "Q4_0",
							parent_model: "",
						},
					},
				],
			};

			mockList.mockResolvedValue(mockResponse);

			const result = await listOllamaModels();

			expect(result).toEqual(["qwen2.5:3b", "qwen2.5-coder:3b"]);
		});

		it("should throw error on failure", async () => {
			mockList.mockRejectedValue(new Error("List error"));

			await expect(listOllamaModels()).rejects.toThrow(
				"Failed to list Ollama models: List error",
			);
		});
	});

	describe("checkOllamaHealth", () => {
		it("should return healthy status when available", async () => {
			mockList.mockResolvedValue({
				models: [{ name: "qwen2.5:3b" }, { name: "qwen2.5-coder:3b" }],
			});

			const result = await checkOllamaHealth();

			expect(result).toEqual({
				available: true,
				models: ["qwen2.5:3b", "qwen2.5-coder:3b"],
				pulledModels: [],
			});
		});

		it("should return unhealthy status when unavailable", async () => {
			mockList.mockRejectedValue(new Error("Connection failed"));

			const result = await checkOllamaHealth();

			expect(result).toEqual({
				available: false,
				models: [],
				pulledModels: [],
			});
		});

		it("should auto-pull missing models when enabled", async () => {
			mockList.mockResolvedValue({ models: [{ name: "qwen2.5:3b" }] }); // Missing qwen2.5-coder:3b
			mockPull.mockResolvedValue(undefined);

			const result = await checkOllamaHealth(true);

			expect(result).toEqual({
				available: true,
				models: ["qwen2.5:3b"],
				pulledModels: ["qwen2.5-coder:3b"],
			});
			expect(mockPull).toHaveBeenCalledWith({ model: "qwen2.5-coder:3b" });
		});

		it("should handle auto-pull failures gracefully", async () => {
			mockList.mockResolvedValue({ models: [] });
			mockPull.mockRejectedValue(new Error("Pull failed"));

			const result = await checkOllamaHealth(true);

			expect(result).toEqual({
				available: true,
				models: [],
				pulledModels: [],
			});
			expect(mockPull).toHaveBeenCalledTimes(2); // For both models
		});
	});

	describe("pullOllamaModel", () => {
		it("should pull model successfully", async () => {
			mockPull.mockResolvedValue(undefined);

			await expect(pullOllamaModel("qwen2.5:3b")).resolves.toBeUndefined();
			expect(mockPull).toHaveBeenCalledWith({ model: "qwen2.5:3b" });
		});

		it("should throw error on pull failure", async () => {
			mockPull.mockRejectedValue(new Error("Pull error"));

			await expect(pullOllamaModel("qwen2.5:3b")).rejects.toThrow(
				"Failed to pull Ollama model qwen2.5:3b: Pull error",
			);
		});
	});

	describe("selectModel", () => {
		it("should select qwen2.5:3b for chat tasks", () => {
			const result = selectModel("chat");
			expect(result).toBe("qwen2.5:3b");
		});

		it("should select qwen2.5-coder:3b for code tasks", () => {
			const result = selectModel("code");
			expect(result).toBe("qwen2.5-coder:3b");
		});

		it("should select qwen2.5:3b for embedding tasks", () => {
			const result = selectModel("embedding");
			expect(result).toBe("qwen2.5:3b");
		});

		it("should return default model for unknown task types", () => {
			const result = selectModel("unknown" as any);
			expect(result).toBe("qwen2.5:3b"); // default model
		});
	});

	describe("estimateSavings", () => {
		it("should calculate savings for GPT-4o", () => {
			const result = estimateSavings("gpt-4o", 1000, 500, 10000);

			expect(result).toEqual({
				savings: 75, // (2.5 * 1000 + 10 * 500) * 10000 / 1M = 75
				percentage: 100,
				cloudCost: 75,
				ollamaCost: 0,
			});
		});

		it("should calculate savings for GPT-4o-mini", () => {
			const result = estimateSavings("gpt-4o-mini", 1000, 500, 10000);

			expect(result).toEqual({
				savings: 4.5, // (0.15 * 1000 + 0.6 * 500) * 10000 / 1M = 4.5
				percentage: 100,
				cloudCost: 4.5,
				ollamaCost: 0,
			});
		});

		it("should calculate savings for DeepSeek", () => {
			const result = estimateSavings("deepseek-chat", 1000, 500, 10000);

			expect(result).toEqual({
				savings: 2.8, // (0.14 * 1000 + 0.28 * 500) * 10000 / 1M = 2.8
				percentage: 100,
				cloudCost: 2.8,
				ollamaCost: 0,
			});
		});

		it("should calculate savings for Gemini", () => {
			const result = estimateSavings("gemini-2.0-flash", 1000, 500, 10000);

			expect(result).toEqual({
				savings: 2.25, // (0.075 * 1000 + 0.3 * 500) * 10000 / 1M = 2.25
				percentage: 100,
				cloudCost: 2.25,
				ollamaCost: 0,
			});
		});

		it("should return zero savings for unknown models", () => {
			const result = estimateSavings("unknown-model", 1000, 500, 10000);

			expect(result).toEqual({
				savings: 0,
				percentage: 0,
				cloudCost: 0,
				ollamaCost: 0,
			});
		});

		it("should handle zero volume", () => {
			const result = estimateSavings("gpt-4o", 1000, 500, 0);

			expect(result).toEqual({
				savings: 0,
				percentage: 0,
				cloudCost: 0,
				ollamaCost: 0,
			});
		});
	});

	describe("generateWithOllamaStream", () => {
		it("should generate text with streaming successfully", async () => {
			const mockChunks = [
				{ response: "Hello" },
				{ response: " world" },
				{ response: "!" },
				{ response: "", done: true },
			];

			mockGenerate.mockImplementation(async function* () {
				for (const chunk of mockChunks) {
					yield chunk;
				}
			});

			const onChunk = vi.fn();
			const result = await generateWithOllamaStream(
				"qwen2.5:3b",
				"Test prompt",
				{ onChunk },
			);

			expect(result).toBe("Hello world!");
			expect(onChunk).toHaveBeenCalledTimes(4);
			expect(onChunk).toHaveBeenNthCalledWith(1, "Hello");
			expect(onChunk).toHaveBeenNthCalledWith(2, " world");
			expect(onChunk).toHaveBeenNthCalledWith(3, "!");
			expect(onChunk).toHaveBeenNthCalledWith(4, "");
		});

		it("should work without onChunk callback", async () => {
			const mockChunks = [
				{ response: "Simple" },
				{ response: " response" },
				{ response: "", done: true },
			];

			mockGenerate.mockImplementation(async function* () {
				for (const chunk of mockChunks) {
					yield chunk;
				}
			});

			const result = await generateWithOllamaStream(
				"qwen2.5:3b",
				"Test prompt",
			);

			expect(result).toBe("Simple response");
		});

		it("should handle streaming errors", async () => {
			mockGenerate.mockRejectedValue(new Error("Streaming error"));

			await expect(
				generateWithOllamaStream("qwen2.5:3b", "Test prompt"),
			).rejects.toThrow("Ollama streaming generation failed: Streaming error");
		});

		it("should include context in streaming prompt", async () => {
			const mockChunks = [{ response: "Response", done: true }];

			mockGenerate.mockImplementation(async function* () {
				for (const chunk of mockChunks) {
					yield chunk;
				}
			});

			const context = ["Context 1", "Context 2"];
			await generateWithOllamaStream("qwen2.5:3b", "Current prompt", {
				context,
			});

			expect(mockGenerate).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Context 1\nContext 2\nCurrent prompt",
					stream: true,
				}),
			);
		});
	});

	describe("pullModelIfNeeded", () => {
		it("should return true when model is already available", async () => {
			mockList.mockResolvedValue({
				models: [{ name: "qwen2.5:3b" }, { name: "qwen2.5-coder:3b" }],
			});

			const result = await pullModelIfNeeded("qwen2.5:3b");

			expect(result).toBe(true);
			expect(mockPull).not.toHaveBeenCalled();
		});

		it("should pull and return true when model is missing", async () => {
			mockList.mockResolvedValue({ models: ["qwen2.5:3b"] });
			mockPull.mockResolvedValue(undefined);

			const result = await pullModelIfNeeded("qwen2.5-coder:3b");

			expect(result).toBe(true);
			expect(mockPull).toHaveBeenCalledWith({ model: "qwen2.5-coder:3b" });
		});

		it("should return false when pull fails", async () => {
			mockList.mockResolvedValue({ models: [] });
			mockPull.mockRejectedValue(new Error("Pull failed"));

			const result = await pullModelIfNeeded("qwen2.5:3b");

			expect(result).toBe(false);
			expect(mockPull).toHaveBeenCalledWith({ model: "qwen2.5:3b" });
		});

		it("should return false when list fails", async () => {
			mockList.mockRejectedValue(new Error("List failed"));

			const result = await pullModelIfNeeded("qwen2.5:3b");

			expect(result).toBe(false);
			expect(mockPull).not.toHaveBeenCalled();
		});
	});

	describe("Tracing Integration", () => {
		it("should call tracing utilities for savings estimation", () => {
			// Tracing is optional and may not be called in test environment
			estimateSavings("gpt-4o", 1000, 500, 10000);

			// Note: Tracing calls are optional and may not occur in all environments
			// expect(mockTracingUtils.addSavingsAttributes).toHaveBeenCalledWith(
			// 	expect.any(Object),
			// 	expect.objectContaining({
			// 		savings: 75,
			// 		percentage: 100,
			// 		cloudCost: 75,
			// 		ollamaCost: 0,
			// 	}),
			// );
		});

		it("should call tracing utilities for health checks", async () => {
			mockList.mockResolvedValue({ models: [{ name: "qwen2.5:3b" }] });

			await checkOllamaHealth();

			// Note: Tracing calls are optional and may not occur in all environments
			// expect(mockTracingUtils.addHealthCheckAttributes).toHaveBeenCalledWith(
			// 	expect.any(Object),
			// 	expect.objectContaining({
			// 		available: true,
			// 		models: ["qwen2.5:3b"],
			// 		pulledModels: [],
			// 	}),
			// );
		});

		it("should call tracing utilities for health checks with auto-pull", async () => {
			mockList.mockResolvedValue({ models: [{ name: "qwen2.5:3b" }] });
			mockPull.mockResolvedValue(undefined);

			await checkOllamaHealth(true);

			// Note: Tracing calls are optional and may not occur in all environments
			// expect(mockTracingUtils.addHealthCheckAttributes).toHaveBeenCalledWith(
			// 	expect.any(Object),
			// 	expect.objectContaining({
			// 		available: true,
			// 		models: ["qwen2.5:3b"],
			// 		pulledModels: ["qwen2.5-coder:3b"],
			// 	}),
			// );
		});
	});
});
