import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import ProviderSelector from "../components/ProviderSelector";

describe("ProviderSelector (server render)", () => {
  it("renders select with providers", () => {
    const providers = ["ollama", "openai"];
    const html = renderToString(
      // @ts-ignore server render for test
      <ProviderSelector providers={providers} selected={"ollama"} />,
    );

    // The output should contain both options
    expect(html).toContain("ollama");
    expect(html).toContain("openai");
    // Should include the select element
    expect(html).toContain("select");
  });
});
