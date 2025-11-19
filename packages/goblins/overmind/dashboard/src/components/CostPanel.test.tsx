/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CostPanel } from "./CostPanel";

// Mock the RuntimeClient
const mockClient = {
  getCostSummary: vi.fn(),
};

describe("CostPanel", () => {
  it("renders loading state initially", async () => {
    // Mock to never resolve to keep loading state
    mockClient.getCostSummary.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(<CostPanel client={mockClient as any} />);
    });

    expect(screen.getByText("Loading costs...")).toBeInTheDocument();
  });

  it("displays cost summary when data is loaded", async () => {
    const mockSummary = {
      totalCost: 10.5,
      totalTasks: 25,
      byProvider: {},
      byGoblin: {},
      byGuild: {},
      recentEntries: [],
    };

    mockClient.getCostSummary.mockResolvedValue(mockSummary);

    await act(async () => {
      render(<CostPanel client={mockClient as any} />);
    });

    // Wait for loading to complete
    expect(await screen.findByText("$10.5000")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("displays error message when fetch fails", async () => {
    mockClient.getCostSummary.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<CostPanel client={mockClient as any} />);
    });

    expect(await screen.findByText("❌ Network error")).toBeInTheDocument();
  });
});
