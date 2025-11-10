import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeepSeekProvider } from "../providers/deepseek-provider.js";

describe("DeepSeekProvider (unit)", () => {
  beforeEach(() => {
    // ensure no leftover mocks
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // cleanup any global fetch set by tests
    try {
      // @ts-ignore
      delete globalThis.fetch;
    } catch {}
  });

  it("generate() returns text when API returns text field", async () => {
    const mockResp = { text: "hello from deepseek" };

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => mockResp,
    })));

    const p = new DeepSeekProvider({ apiKey: "test-key", baseUrl: "https://api.deepseek.test" });

    const out = await p.generate("test prompt");
    expect(out).toBe("hello from deepseek");
  });

  it("generate() returns first choice when API returns choices array", async () => {
    const mockResp = { choices: [{ text: "choice-1" }] };

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => mockResp,
    })));

    const p = new DeepSeekProvider({ apiKey: "test-key" });
    const out = await p.generate("prompt");
    expect(out).toBe("choice-1");
  });

  it("checkHealth() returns true on minimal successful response", async () => {
    const mockResp = { choices: [1] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => mockResp })));

    const p = new DeepSeekProvider({ apiKey: "test-key" });
    const ok = await p.checkHealth();
    expect(ok).toBe(true);
  });

  it("checkHealth() returns false on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, statusText: 'err', text: async () => 'err' })));

    const p = new DeepSeekProvider({ apiKey: "test-key" });
    const ok = await p.checkHealth();
    expect(ok).toBe(false);
  });
});
