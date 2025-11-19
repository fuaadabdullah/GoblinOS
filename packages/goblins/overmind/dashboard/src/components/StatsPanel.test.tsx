/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StatsPanel } from "./StatsPanel";

// Mock the RuntimeClient
const mockClient = {
  getStats: vi.fn(),
};

describe("StatsPanel", () => {
  it("renders empty state when no goblinId is provided", () => {
    render(<StatsPanel client={mockClient as any} goblinId={null} />);
    expect(screen.getByText("Select a goblin to view stats")).toBeInTheDocument();
  });

  it("renders loading state when fetching stats", async () => {
    mockClient.getStats.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(<StatsPanel client={mockClient as any} goblinId="test-goblin" />);
    });

    expect(screen.getByText("Loading stats...")).toBeInTheDocument();
  });

  it("displays stats when data is loaded", async () => {
    const mockStats = {
      totalTasks: 42,
      successRate: 0.95,
      avgDuration: 1250,
      lastRun: new Date("2024-01-15T10:30:00Z"),
    };

    mockClient.getStats.mockResolvedValue(mockStats);

    await act(async () => {
      render(<StatsPanel client={mockClient as any} goblinId="test-goblin" />);
    });

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("0.9%")).toBeInTheDocument();
    expect(screen.getByText("1.3s")).toBeInTheDocument();
  });

  it("displays error message when fetch fails", async () => {
    mockClient.getStats.mockRejectedValue(new Error("Connection failed"));

    await act(async () => {
      render(<StatsPanel client={mockClient as any} goblinId="test-goblin" />);
    });

    expect(await screen.findByText("Connection failed")).toBeInTheDocument();
  });
});
