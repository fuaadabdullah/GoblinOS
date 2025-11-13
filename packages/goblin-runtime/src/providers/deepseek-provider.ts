import type { GenerateOptions, ModelProvider } from "../types.js";

/**
 * DeepSeekProvider - simple HTTP client wrapper for DeepSeek-like API
 *
 * Notes / assumptions:
 * - DeepSeek SDK is not available; implement lightweight REST client using
 *   global fetch (Node 18+). If running on older Node, users should provide
 *   a fetch polyfill. The implementation keeps generateStream simple by
 *   yielding the final text as a single chunk when streaming isn't available.
 * - API surface is intentionally minimal (generate, generateStream, checkHealth)
 */
export class DeepSeekProvider implements ModelProvider {
    private apiKey?: string;
    private baseUrl: string;
    private defaultModel: string;

    constructor(options: { apiKey?: string; baseUrl?: string; model?: string } = {}) {
        this.apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
        this.baseUrl = options.baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.ai/v1";
        this.defaultModel = options.model || "default";

        if (!this.apiKey) {
            throw new Error("DeepSeek API key required. Set DEEPSEEK_API_KEY or pass apiKey in options.");
        }
    }

    private async post(path: string, body: any): Promise<any> {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`DeepSeek API error: ${res.status} ${res.statusText} ${text}`);
        }

        return (await res.json()) as any;
    }

    async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
        const model = options.model || this.defaultModel;
        const payload = {
            model,
            prompt,
            max_tokens: options.maxTokens ?? 2048,
            temperature: options.temperature ?? 0.7,
            system: options.systemPrompt,
        };

        const result: any = await this.post(`/generate`, payload);

        // Expecting { text: string } or { choices: [{ text }] }
        if (result && typeof result.text === "string") return result.text;
        if (result && Array.isArray(result.choices) && result.choices[0]) return result.choices[0].text || "";
        return String((result && (result.output || result.data)) || "");
    }

    async *generateStream(prompt: string, options: GenerateOptions = {}): AsyncIterable<string> {
        // Streaming endpoints vary between providers; as a conservative default
        // call the non-streaming endpoint and yield the whole text as one chunk.
        const text = await this.generate(prompt, options);
        yield text;
    }

    async checkHealth(): Promise<boolean> {
        try {
            // Simple lightweight health check: attempt a tiny generation
            const r: any = await this.post(`/generate`, {
                model: this.defaultModel,
                prompt: "Hello",
                max_tokens: 1,
            });
            return !!(r && (r.text || (Array.isArray(r.choices) && r.choices.length)));
        } catch (err) {
            console.warn("DeepSeek health check failed:", err);
            return false;
        }
    }
}
