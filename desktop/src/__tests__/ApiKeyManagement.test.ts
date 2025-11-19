import { describe, expect, it } from "vitest";
import { runtimeClient } from "../api/tauri-client";

describe("API Key Management", () => {
	it("should store and retrieve API keys", async () => {
		const provider = "openai";
		const apiKey = "test-api-key-123";

		// Store the API key
		await runtimeClient.storeApiKey(provider, apiKey);

		// Retrieve the API key
		const retrievedKey = await runtimeClient.getApiKey(provider);

		// Verify it matches
		expect(retrievedKey).toBe(apiKey);
	});

	it("should return null for non-existent API keys", async () => {
		const provider = "nonexistent";

		// Try to retrieve a non-existent API key
		const retrievedKey = await runtimeClient.getApiKey(provider);

		// Should return null
		expect(retrievedKey).toBeNull();
	});

	it("should clear API keys", async () => {
		const provider = "anthropic";
		const apiKey = "test-anthropic-key";

		// Store the API key
		await runtimeClient.storeApiKey(provider, apiKey);

		// Verify it's stored
		let retrievedKey = await runtimeClient.getApiKey(provider);
		expect(retrievedKey).toBe(apiKey);

		// Clear the API key
		await runtimeClient.clearApiKey(provider);

		// Verify it's cleared
		retrievedKey = await runtimeClient.getApiKey(provider);
		expect(retrievedKey).toBeNull();
	});

	it("should list available providers", async () => {
		const providers = await runtimeClient.getProviders();

		// Should return an array of provider names
		expect(Array.isArray(providers)).toBe(true);
		expect(providers.length).toBeGreaterThan(0);

		// Should include common providers
		expect(providers).toContain("openai");
		expect(providers).toContain("anthropic");
	});

	it("should list models for providers", async () => {
		const openaiModels = await runtimeClient.getProviderModels("openai");
		const anthropicModels = await runtimeClient.getProviderModels("anthropic");

		// Should return arrays of model names
		expect(Array.isArray(openaiModels)).toBe(true);
		expect(Array.isArray(anthropicModels)).toBe(true);

		// Should have some models
		expect(openaiModels.length).toBeGreaterThan(0);
		expect(anthropicModels.length).toBeGreaterThan(0);
	});
});
